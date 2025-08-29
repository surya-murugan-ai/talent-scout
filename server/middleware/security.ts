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
        defaultSrc: ["'self'", "http:", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://va.vercel-scripts.com", "http:", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "http:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "http:", "https:"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "https://api.openai.com", "http://54.197.65.143:5000", "http://54.197.65.143:8000", "wss:", "ws:", "http:", "https:"],
        upgradeInsecureRequests: null, // Disable automatic HTTPS upgrade
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    hsts: false, // Disable HSTS to prevent HTTPS redirects
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://*.replit.app', 'https://*.replit.dev', 'http://54.197.65.143:5000', 'http://54.197.65.143:8000']
      : ['http://localhost:5173', 'http://localhost:5000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Compression
  app.use(compression());

  // Rate limiting for general API endpoints
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 1000 : 1000, // limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // Rate limiting for polling endpoints (more lenient)
  const pollingLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // limit each IP to 60 requests per minute for polling
    message: {
      error: 'Too many polling requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // Apply polling limiter to specific endpoints
  app.use('/api/jobs', pollingLimiter);
  app.use('/api/stats', pollingLimiter);
  app.use('/api/activities', pollingLimiter);
  
  // Apply general limiter to other API endpoints
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