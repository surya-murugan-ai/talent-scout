# Local Deployment Guide

## Prerequisites

### System Requirements
- **Node.js**: Version 18+ (recommended: 20+)
- **npm**: Version 8+ (comes with Node.js)
- **PostgreSQL**: Version 14+ (local or cloud instance)
- **Git**: For cloning the repository

### Required API Keys
- **OpenAI API Key**: For candidate analysis
- **Apify API Token**: For LinkedIn profile enrichment
- **Database URL**: PostgreSQL connection string

## Installation Steps

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd talent-acquisition-platform
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit the `.env` file with your credentials:
```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/talent_acquisition

# API Keys
OPENAI_API_KEY=sk-your-openai-api-key-here
APIFY_API_TOKEN=your-apify-token-here

# Server Configuration
NODE_ENV=development
PORT=5000

# Database Connection Details (if using separate configs)
PGHOST=localhost
PGPORT=5432
PGUSER=your-username
PGPASSWORD=your-password
PGDATABASE=talent_acquisition
```

### 4. Database Setup

#### Option A: Local PostgreSQL
1. Install PostgreSQL on your system
2. Create a new database:
```sql
CREATE DATABASE talent_acquisition;
```

#### Option B: Cloud Database (Recommended)
Use a cloud provider like:
- **Neon** (serverless PostgreSQL)
- **Supabase** 
- **Railway**
- **Heroku Postgres**

### 5. Initialize Database Schema
```bash
npm run db:push
```

This will create all necessary tables:
- candidates
- projects  
- processing_jobs
- activities
- users

### 6. Start the Development Server
```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5000
- **API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/health

## Verification Steps

### 1. Check Server Status
```bash
curl http://localhost:5000/health
```
Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-13T...",
  "environment": "development",
  "uptime": 123.456
}
```

### 2. Check Database Connection
```bash
curl http://localhost:5000/api/database/health
```
Expected response:
```json
{
  "status": "healthy",
  "tables": [...],
  "connectionTest": true,
  "totalRecords": 0
}
```

### 3. Test API Endpoints
```bash
# Test candidates endpoint
curl http://localhost:5000/api/candidates

# Test stats endpoint  
curl http://localhost:5000/api/stats

# Test OpenAI integration
curl -X POST http://localhost:5000/api/analyze-candidate \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","title":"Software Engineer","skills":"JavaScript"}'
```

## File Upload Testing

### Prepare Test Data
Create a test CSV file (`test_candidates.csv`):
```csv
name,email,title,company,skills
John Doe,john@example.com,Software Engineer,Tech Corp,JavaScript React
Jane Smith,jane@example.com,Product Manager,Startup Inc,Product Management
```

### Upload Test
```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@test_candidates.csv"
```

## Production Build

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
- Verify DATABASE_URL is correct
- Check PostgreSQL service is running
- Ensure database exists and user has permissions

#### OpenAI API Errors
- Verify OPENAI_API_KEY is valid
- Check API quota and billing status
- Ensure network connectivity

#### LinkedIn API Issues  
- Verify APIFY_API_TOKEN is valid
- Check Apify account usage limits
- Ensure LinkedIn scraper actor is available

#### Port Already in Use
```bash
# Kill process using port 5000
lsof -ti:5000 | xargs kill -9

# Or use different port
PORT=3000 npm run dev
```

### Environment Variables Check
```bash
# Verify all required environment variables
node -e "
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Missing');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing');
console.log('APIFY_API_TOKEN:', process.env.APIFY_API_TOKEN ? '✓ Set' : '✗ Missing');
"
```

## Development Workflow

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start           # Start production server
npm run db:push     # Update database schema
npm run db:studio   # Open database viewer (if available)
```

### Code Structure
```
├── client/         # Frontend React application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── types/
├── server/         # Backend Express server
│   ├── routes.ts   # API endpoints
│   ├── storage.ts  # Database operations
│   └── services/   # External API integrations
├── shared/         # Shared types and schemas
│   └── schema.ts   # Database schema
└── migrations/     # Database migrations
```

### Hot Reload
- Frontend changes automatically reload
- Backend changes restart the server
- Database schema changes require `npm run db:push`

## Security Considerations

### Local Development
- Never commit `.env` file to git
- Use strong database passwords
- Keep API keys secure
- Use HTTPS in production

### Network Access
- Development server binds to `0.0.0.0:5000`
- Accessible from local network
- Use firewall rules if needed

## Performance Optimization

### Database Indexing
The schema includes optimized indexes for:
- Candidate searching and filtering
- Job status queries
- Activity timeline

### File Processing
- Large files processed asynchronously
- Progress tracking via WebSocket/polling
- Memory-efficient streaming

### API Response Caching
- Database queries cached for performance
- Static assets served with cache headers
- API responses optimized for speed

## Backup and Recovery

### Database Backup
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql $DATABASE_URL < backup_file.sql
```

### Environment Backup
- Save `.env` file securely
- Document API key sources
- Keep database credentials safe

## Next Steps

1. **Production Deployment**: Use services like Vercel, Railway, or Heroku
2. **Domain Setup**: Configure custom domain and SSL
3. **Monitoring**: Add error tracking and performance monitoring
4. **Scaling**: Configure load balancing and database optimization
5. **CI/CD**: Set up automated testing and deployment

## Support

### Logs and Debugging
- Server logs: Console output during `npm run dev`
- Database logs: Check PostgreSQL logs
- API debugging: Use browser dev tools or Postman

### Performance Monitoring
- Monitor API response times
- Track database query performance
- Watch memory and CPU usage

For additional support, refer to:
- `TESTING.md` for comprehensive testing
- `PRODUCTION-LAUNCH.md` for deployment readiness
- `replit.md` for project architecture details