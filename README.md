# 🎯 Talent Scout - AI-Powered Candidate Scoring System

A modern web application that helps Talent Acquisition teams identify and prioritize potential candidates using AI-powered scoring, LinkedIn profile enrichment, and intelligent candidate analysis.

## ✨ Features

### 🤖 AI-Powered Candidate Scoring
- **Intelligent Analysis**: Uses OpenAI GPT-4 to analyze candidate profiles
- **Weighted Scoring**: Customizable scoring weights for different criteria
- **Skill Matching**: Advanced skill comparison against job requirements
- **Open to Work Detection**: Identifies candidates actively seeking opportunities

### 🔗 LinkedIn Integration
- **Profile Enrichment**: Automatically enriches candidate data from LinkedIn
- **Apify Integration**: Uses Apify actors for reliable LinkedIn scraping
- **Real-time Data**: Fetches latest profile information and activity
- **Skill Extraction**: Extracts skills, experience, and engagement metrics

### 📊 Candidate Management
- **File Upload**: Support for CSV and Excel file uploads
- **ATS Integration**: Import historical candidate data from ATS systems
- **Candidate Table**: Interactive table with sorting and filtering
- **Activity Feed**: Real-time updates on candidate processing

### 🎨 Modern UI/UX
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark/Light Mode**: Toggle between themes
- **Real-time Updates**: Live notifications and status updates
- **Beautiful Charts**: Visual representation of candidate scores

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- OpenAI API key
- Apify API token

### 1. Clone & Install
```bash
git clone https://github.com/surya-murugan-ai/talent-scout.git
cd talent-scout
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/talent_scout
OPENAI_API_KEY=sk-your-openai-api-key
APIFY_API_TOKEN=your-apify-token
```

### 3. Database Setup
```bash
npm run db:push
```

### 4. Start Development
```bash
npm run dev
```

Open http://localhost:5000

## 📋 API Keys Setup

### OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new secret key
3. Copy the key (starts with `sk-`)

### Apify API Token
1. Go to [Apify Console](https://console.apify.com/account#/integrations)
2. Copy your API token
3. Used for LinkedIn profile enrichment

### Database Options

**Option 1: Neon (Recommended)**
1. Visit [Neon](https://neon.tech)
2. Create free account and database
3. Copy connection string

**Option 2: Local PostgreSQL**
```bash
createdb talent_scout
# Use: postgresql://username:password@localhost:5432/talent_scout
```

## 🎯 How It Works

### 1. Candidate Upload
Upload CSV/Excel files with candidate information:
```csv
Name,Email,Phone,LinkedIn,Position,Company,Experience,Skills,Location
John Doe,john@example.com,1234567890,https://linkedin.com/in/johndoe,Software Engineer,Tech Corp,3 years,"JavaScript, React, Node.js",San Francisco
```

### 2. LinkedIn Enrichment
- System automatically scrapes LinkedIn profiles
- Extracts skills, experience, and engagement data
- Detects "open to work" signals
- Enriches candidate data with real-time information

### 3. AI Analysis
- OpenAI analyzes each candidate against job requirements
- Generates scores for:
  - **Skill Match**: How well skills align with requirements
  - **Open to Work**: Likelihood of candidate being available
  - **Job Stability**: Based on career history and patterns
  - **Engagement**: Activity level and professional presence

### 4. Scoring & Ranking
- Weighted scoring based on configurable criteria
- Real-time candidate ranking
- Detailed analysis reports
- Export capabilities

## 🛠️ Project Structure

```
TalentScout-1/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── types/         # TypeScript types
├── server/                # Express.js backend
│   ├── services/          # Business logic
│   ├── middleware/        # Express middleware
│   └── routes.ts          # API routes
├── shared/                # Shared schemas
├── migrations/            # Database migrations
└── docs/                  # Documentation
```

## 🔧 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run check        # TypeScript type checking
npm run db:push      # Push database schema changes
```

## 📊 Scoring Algorithm

The system uses a weighted scoring algorithm with four main criteria:

1. **Skill Match (40%)**: How well candidate skills match job requirements
2. **Open to Work (30%)**: Likelihood of candidate being available
3. **Job Stability (20%)**: Based on career history and patterns
4. **Engagement (10%)**: Professional activity and presence

### Scoring Weights
```typescript
{
  skillMatch: 0.4,    // 40% weight
  openToWork: 0.3,    // 30% weight
  jobStability: 0.2,  // 20% weight
  engagement: 0.1     // 10% weight
}
```

## 🔗 API Endpoints

### Health Checks
- `GET /health` - Application health
- `GET /api/database/health` - Database health

### Candidate Management
- `POST /api/upload` - Upload candidate files
- `GET /api/candidates` - Get all candidates
- `POST /api/candidates/:id/enrich` - Enrich candidate with LinkedIn data
- `POST /api/ats/import` - Import ATS data

### LinkedIn Integration
- `POST /api/linkedin/test` - Test LinkedIn API connection
- `GET /api/linkedin/status` - LinkedIn service status

## 🧪 Testing

### Test Files
```bash
# Test LinkedIn integration
node test-linkedin-service.mjs

# Test Apify access
node test-apify-access.js

# Run comprehensive tests
node test-runner.js
```

### Sample Data
Use `test_candidates.csv` for testing:
```csv
Name,Email,Phone,LinkedIn,Position,Company,Experience,Skills,Location
Surya Murugan,surya@example.com,9967137495,https://linkedin.com/in/surya-murugan,Full Stack Developer,Aimplify,1 year,"JavaScript, React, Node.js",Bangalore
```

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm run start
```

### Environment Variables
- `NODE_ENV`: Set to `production` for production mode
- `PORT`: Server port (default: 5000)
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key
- `APIFY_API_TOKEN`: Apify API token

## 📚 Documentation

- [Quick Start Guide](QUICK-START.md)
- [Local Deployment](LOCAL-DEPLOYMENT.md)
- [Production Launch](PRODUCTION-LAUNCH.md)
- [Testing Guide](TESTING.md)
- [Deployment Guide](DEPLOYMENT.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/surya-murugan-ai/talent-scout/issues)
- **Documentation**: Check the docs folder
- **Testing**: See `TESTING.md` for troubleshooting

## 🎯 Roadmap

- [ ] Advanced candidate filtering
- [ ] Email integration for outreach
- [ ] Interview scheduling
- [ ] Candidate pipeline management
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Mobile app

---

**Built with ❤️ by the Talent Scout Team**
