# Quick Check API Documentation

## Overview
The Quick Check API allows you to quickly lookup a candidate's LinkedIn profile, enrich their data, calculate AI-powered scoring, and optionally save the information to the database.

**Base URL:** `http://54.197.65.143:5000`

**Endpoint:** `POST /api/quick-check`

**Processing Time:** ~25-30 seconds (due to LinkedIn scraping via Apify)

---

## Request

### Headers
```
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Full name of the candidate |
| `email` | string | No | Email address of the candidate |
| `company` | string | No | Current company name (will be converted to LinkedIn URL) |
| `title` | string | No | Current job title |
| `location` | string | No | **⚠️ Do NOT use - causes 0 results** |
| `com_id` | string | No | Company ID for multi-tenancy and custom scoring weights |
| `saveToDatabase` | boolean | No | Whether to save the candidate to database (default: `true`) |

### Example Request

```bash
curl -X POST http://54.197.65.143:5000/api/quick-check \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Surya Murugan",
    "email": "surya@example.com",
    "company": "Aimplifytech",
    "title": "Full Stack Developer",
    "com_id": "Aimplify-123",
    "saveToDatabase": false
  }'
```

### JavaScript Example

```javascript
const response = await fetch('http://54.197.65.143:5000/api/quick-check', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Surya Murugan',
    email: 'surya@example.com',
    company: 'Aimplifytech',
    title: 'Full Stack Developer',
    com_id: 'Aimplify-123',
    saveToDatabase: false
  })
});

const data = await response.json();
console.log(data);
```

### Python Example

```python
import requests

url = "http://54.197.65.143:5000/api/quick-check"
payload = {
    "name": "Surya Murugan",
    "email": "surya@example.com",
    "company": "Aimplifytech",
    "title": "Full Stack Developer",
    "com_id": "Aimplify-123",
    "saveToDatabase": False
}

response = requests.post(url, json=payload)
data = response.json()
print(data)
```

---

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "candidateId": "uuid-string-or-null",
    "candidateInfo": {
      "name": "Surya Murugan",
      "email": "surya@example.com",
      "providedCompany": "Aimplifytech",
      "providedTitle": "Full Stack Developer",
      "location": null
    },
    "linkedinProfile": {
      "profileUrl": "https://www.linkedin.com/in/surya-murugan-ragaiyan",
      "currentCompany": "Aimplify",
      "currentTitle": "Python Backend Developer || Machine Learning || Deep Learning || Agentic AI || Flask || Django || DRF ||  SQL -- Open for Opportunity.",
      "skills": [
        {
          "title": "n8n",
          "subComponents": [...]
        },
        {
          "title": "AI Agents",
          "subComponents": [...]
        },
        {
          "title": "JavaScript",
          "subComponents": [...]
        }
      ],
      "openToWork": false,
      "lastActive": "1 week ago",
      "jobHistory": [
        {
          "company": "Aimplify",
          "title": "Full Stack Developer",
          "duration": "6 mos",
          "startDate": "May 2025",
          "endDate": "Present"
        }
      ],
      "recentActivity": []
    },
    "scoring": {
      "skillMatch": 45,
      "openToWork": 0,
      "jobStability": 75,
      "engagement": 15,
      "companyConsistency": 85,
      "overallScore": 52.5,
      "priority": "Medium"
    },
    "hireability": {
      "score": 78,
      "potentialToJoin": "High",
      "factors": {
        "openToWork": false,
        "companyMatch": true,
        "recentActivity": true,
        "skillsAvailable": true
      }
    },
    "insights": [
      "Strong technical skills in AI, Machine Learning, and Full Stack Development",
      "Currently employed at Aimplify, showing company consistency",
      "Active on LinkedIn with recent engagement"
    ],
    "companyDifference": "Same",
    "savedToDatabase": false,
    "isExistingCandidate": false
  },
  "processingTime": 26388,
  "message": "Quick check completed - data not saved"
}
```

### Response Fields Explained

| Field | Description |
|-------|-------------|
| `success` | Boolean indicating if the request was successful |
| `data.candidateId` | Database ID if saved, null otherwise |
| `data.candidateInfo` | Information provided in the request |
| `data.linkedinProfile` | Enriched LinkedIn profile data (null if not found) |
| `data.linkedinProfile.profileUrl` | LinkedIn profile URL |
| `data.linkedinProfile.currentCompany` | Current company from LinkedIn |
| `data.linkedinProfile.currentTitle` | Current job title/headline from LinkedIn |
| `data.linkedinProfile.skills` | Array of skills with endorsements |
| `data.linkedinProfile.openToWork` | Whether the candidate is open to work |
| `data.linkedinProfile.lastActive` | Last activity on LinkedIn |
| `data.linkedinProfile.jobHistory` | Employment history |
| `data.scoring` | AI-powered scoring breakdown |
| `data.scoring.overallScore` | Overall candidate score (0-100) |
| `data.scoring.priority` | Priority level: "High", "Medium", or "Low" |
| `data.hireability` | Hireability assessment |
| `data.hireability.score` | Hireability score (0-100) |
| `data.hireability.potentialToJoin` | Likelihood to join: "High", "Medium", or "Low" |
| `data.insights` | AI-generated insights about the candidate |
| `data.companyDifference` | Whether resume company matches LinkedIn company |
| `data.savedToDatabase` | Whether the candidate was saved to database |
| `data.isExistingCandidate` | Whether the candidate already existed in database |
| `processingTime` | Time taken to process the request (milliseconds) |
| `message` | Human-readable status message |

### Error Response (400 Bad Request)

```json
{
  "error": "Name is required",
  "code": "MISSING_NAME"
}
```

### Error Response (500 Internal Server Error)

```json
{
  "error": "Quick check failed",
  "message": "Detailed error message",
  "code": "QUICK_CHECK_ERROR"
}
```

---

## How It Works

1. **LinkedIn Search**: Uses Apify's LinkedIn Profile Search actor to find the candidate's profile
   - Searches by name, company, and job title
   - Company name is automatically converted to LinkedIn company URL format

2. **Profile Enrichment**: If profile is found, enriches it with:
   - Current company and title
   - Skills and endorsements
   - Job history
   - Open to work status
   - Recent activity
   - Education
   - Certifications

3. **AI Scoring**: Uses OpenAI GPT-4 to analyze the candidate and calculate:
   - Skill match score
   - Open to work score
   - Job stability score
   - Platform engagement score
   - Company consistency score
   - Overall score and priority level

4. **Hireability Calculation**: Calculates potential to join based on:
   - AI analysis score (40%)
   - Company difference (20% bonus if different)
   - Open to work status (20% bonus)
   - Recent activity (10% bonus)
   - Skills availability (10% bonus)

5. **Database Save** (optional): Saves or updates the candidate in the database

---

## Important Notes

### ⚠️ Known Issues

1. **Location Parameter**: Do NOT include the `location` parameter in the request. It causes Apify to return 0 results. This is a known issue with the Apify actor.

2. **Processing Time**: The endpoint takes 25-30 seconds to complete due to LinkedIn scraping. Make sure your HTTP client has a timeout of at least 60 seconds.

3. **Company Name Format**: 
   - The API automatically converts company names to LinkedIn URL format
   - Example: "Aimplify Tech" → `https://www.linkedin.com/company/aimplifytech/`
   - Spaces and special characters are removed, and the name is lowercased

### ✅ Best Practices

1. **Always provide company name**: For best results, include the company name to narrow down the search

2. **Use exact company name**: Use the exact company name as it appears on LinkedIn for better matching

3. **Set appropriate timeout**: Set HTTP client timeout to at least 60 seconds

4. **Handle null linkedinProfile**: Always check if `linkedinProfile` is null before accessing its properties

5. **Use com_id for multi-tenancy**: If you have multiple companies using the API, always include `com_id` for proper data isolation and custom scoring weights

---

## Rate Limiting

- No rate limiting is currently implemented
- Recommended: Max 10 concurrent requests to avoid overloading Apify

---

## Pricing

- Each request uses Apify credits
- Approximate cost: $0.004 per profile (full profile scraping)
- Search page results: $0.1 per 25 profiles

---

## Support

For issues or questions:
- Check the application logs: `pm2 logs talent-scout-app`
- Verify Apify API token is set correctly
- Ensure the server is running: `pm2 status`

---

## Changelog

### Version 1.0.0 (2025-10-08)
- Initial release
- LinkedIn profile search and enrichment
- AI-powered scoring
- Hireability calculation
- Database integration
- Multi-tenancy support via `com_id`

---

## Example Use Cases

### 1. Quick Candidate Lookup (No Database Save)
```bash
curl -X POST http://54.197.65.143:5000/api/quick-check \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "company": "Google",
    "title": "Software Engineer",
    "saveToDatabase": false
  }'
```

### 2. Add Candidate to Database
```bash
curl -X POST http://54.197.65.143:5000/api/quick-check \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "company": "Microsoft",
    "title": "Product Manager",
    "com_id": "company-123",
    "saveToDatabase": true
  }'
```

### 3. Check if Candidate Exists
```bash
curl -X POST http://54.197.65.143:5000/api/quick-check \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Existing Candidate",
    "email": "existing@example.com",
    "saveToDatabase": true
  }'
```
*Response will include `isExistingCandidate: true` if the email already exists in the database*

---

## Technical Details

### Technology Stack
- **Backend**: Node.js with Express
- **LinkedIn Scraping**: Apify (actor ID: `M2FMdjRVeF1HPGFcc`)
- **AI Analysis**: OpenAI GPT-4
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM

### Apify Actor Configuration
```javascript
{
  "searchQuery": "Full Name",
  "currentCompanies": ["https://www.linkedin.com/company/companyname/"],
  "currentJobTitles": ["Job Title"],
  "maxItems": 20,
  "profileScraperMode": "Full",
  "recentlyChangedJobs": false,
  "startPage": 1
}
```

### Environment Variables Required
- `APIFY_API_TOKEN`: Apify API token
- `OPENAI_API_KEY`: OpenAI API key
- `DATABASE_URL`: PostgreSQL connection string

---

## Troubleshooting

### Issue: linkedinProfile is null
**Possible Causes:**
1. Profile doesn't exist on LinkedIn
2. Company name doesn't match LinkedIn company name
3. Location parameter was included (remove it)
4. Profile is private/not searchable

**Solution:**
- Try with just the name (without company/title)
- Verify the company name on LinkedIn
- Remove the location parameter

### Issue: Timeout Error
**Cause:** Request takes longer than client timeout

**Solution:**
- Increase HTTP client timeout to 60+ seconds
- The endpoint takes 25-30 seconds to complete

### Issue: 0 results from Apify
**Cause:** Search criteria too restrictive or location parameter included

**Solution:**
- Remove location parameter
- Try with fewer search criteria
- Verify company name format

---

## API Endpoints (Other)

For complete API documentation, see:
- `GET /api/candidates` - List all candidates
- `GET /api/candidates/:id` - Get candidate details
- `POST /api/upload-resumes` - Bulk upload resumes
- `GET /api/stats` - Get statistics
- `GET /health` - Health check

---

*Last Updated: October 8, 2025*
