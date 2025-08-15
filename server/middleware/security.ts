import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import compression from 'compression';
import type { Express } from 'express';

export function setupSecurityMiddleware(app: Express) {
  // Enable trust proxy for Replit
  app.set('trust proxy', 1);
  
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://va.vercel-scripts.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.openai.com", "wss:", "ws:"],
      },
    },
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://*.replit.app', 'https://*.replit.dev']
      : ['http://localhost:5173', 'http://localhost:5000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Compression
  app.use(compression());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
    message: {
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  app.use('/api/', limiter);

  // File upload rate limiting (more restrictive)
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 file uploads per hour
    message: {
      error: 'Too many file uploads, please try again later.',
    },
  });
  
  app.use('/api/upload', uploadLimiter);

  // API key validation middleware
  app.use('/api/', (req, res, next) => {
    // Skip validation for GET endpoints that don't need auth
    const publicEndpoints = ['/api/stats', '/api/candidates', '/api/jobs', '/api/activities', '/api/scoring'];
    const isPublicEndpoint = publicEndpoints.some(endpoint => req.path.startsWith(endpoint));
    
    if (req.method === 'GET' && isPublicEndpoint) {
      return next();
    }

    // For production, you might want to add API key validation here
    // For now, we'll allow all requests in development
    next();
  });
}

// Error handling middleware
export function setupErrorHandling(app: Express) {
  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Global error handler:', err);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    res.status(err.status || 500).json({
      error: isDevelopment ? err.message : 'Internal server error',
      ...(isDevelopment && { stack: err.stack }),
    });
  });

  // 404 handler only for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      error: 'API endpoint not found',
      path: req.originalUrl,
    });
  });
}