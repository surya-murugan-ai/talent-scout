# Quick Check API - Quick Reference

## Endpoint
```
POST http://54.197.65.143:5000/api/quick-check
```

## Minimal Request
```bash
curl -X POST http://54.197.65.143:5000/api/quick-check \
  -H "Content-Type: application/json" \
  -d '{"name": "Full Name"}'
```

## Full Request
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

## Request Parameters

| Parameter | Required | Type | Example |
|-----------|----------|------|---------|
| `name` | ✅ Yes | string | "John Doe" |
| `email` | ❌ No | string | "john@example.com" |
| `company` | ❌ No | string | "Google" |
| `title` | ❌ No | string | "Software Engineer" |
| `location` | ⛔ **DO NOT USE** | string | ❌ Causes 0 results |
| `com_id` | ❌ No | string | "company-123" |
| `saveToDatabase` | ❌ No | boolean | true/false (default: true) |

## Response Structure
```json
{
  "success": true,
  "data": {
    "candidateId": "uuid-or-null",
    "linkedinProfile": {
      "profileUrl": "https://linkedin.com/in/...",
      "currentCompany": "Company Name",
      "currentTitle": "Job Title",
      "skills": [...],
      "openToWork": false,
      "jobHistory": [...]
    },
    "scoring": {
      "overallScore": 75,
      "priority": "High"
    },
    "hireability": {
      "score": 85,
      "potentialToJoin": "High"
    }
  },
  "processingTime": 26000
}
```

## Key Points

✅ **Works:**
- Name only
- Name + Company
- Name + Company + Title
- Name + Email

⛔ **Don't Use:**
- Location parameter (causes 0 results)

⏱️ **Processing Time:**
- 25-30 seconds (normal)
- Set HTTP timeout to 60+ seconds

🔑 **Important:**
- LinkedIn profile may be null if not found
- Always check `linkedinProfile` before accessing properties
- Company name is auto-converted to LinkedIn URL format

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (missing name) |
| 500 | Server Error |

## Quick Test
```bash
# Test with a known profile
curl -X POST http://54.197.65.143:5000/api/quick-check \
  -H "Content-Type: application/json" \
  -d '{"name":"Surya Murugan","company":"Aimplifytech","title":"Full Stack Developer","saveToDatabase":false}' \
  --max-time 60
```

## Health Check
```bash
curl http://54.197.65.143:5000/health
```

---

For full documentation, see [QUICK-CHECK-API.md](./QUICK-CHECK-API.md)
