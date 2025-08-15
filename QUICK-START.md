# Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- `DATABASE_URL`: Your PostgreSQL connection string
- `OPENAI_API_KEY`: Your OpenAI API key 
- `APIFY_API_TOKEN`: Your Apify token for LinkedIn integration

### 3. Setup Database
```bash
npm run db:push
```

### 4. Start Development Server
```bash
npm run dev
```

Open http://localhost:5000

## Getting API Keys

### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the key starting with `sk-`

### Apify API Token  
1. Go to https://console.apify.com/account#/integrations
2. Copy your API token
3. Used for LinkedIn profile enrichment

### Database Options
**Option 1: Neon (Recommended)**
1. Go to https://neon.tech
2. Create free account and database
3. Copy connection string

**Option 2: Local PostgreSQL**
```bash
# Install PostgreSQL
createdb talent_acquisition
# Use: postgresql://username:password@localhost:5432/talent_acquisition
```

## Test the Setup

### Upload a CSV file:
```csv
name,email,title,company
John Doe,john@example.com,Software Engineer,Tech Corp
```

### Check API endpoints:
- Health: http://localhost:5000/health
- Database: http://localhost:5000/api/database/health
- Dashboard: http://localhost:5000

## Need Help?
- See `LOCAL-DEPLOYMENT.md` for detailed instructions
- Check `TESTING.md` for troubleshooting
- Review `replit.md` for architecture details