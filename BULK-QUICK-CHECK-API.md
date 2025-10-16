# Bulk Quick Check API Documentation

## Overview
The Bulk Quick Check API allows you to upload a CSV or XLSX file with multiple candidates and process them with the same logic as the single quick-check endpoint. It includes pagination, existing candidate detection, LinkedIn enrichment, AI scoring, and database saving.

**Base URL:** `http://54.197.65.143:5000`

**Endpoint:** `POST /api/bulk-quick-check`

**Processing Time:** ~25-30 seconds per new candidate, ~150ms for existing candidates

---

## Features

✅ **Upload CSV/XLSX** - Process multiple candidates from a file
✅ **Pagination** - Handle large files in chunks (default: 10 per page)
✅ **Existing Candidate Detection** - Checks email against database before processing
✅ **LinkedIn Enrichment** - Full profile data via Apify
✅ **AI Scoring** - OpenAI GPT-4 analysis with hireability calculation
✅ **Batch Processing** - Process candidates sequentially with error handling
✅ **Progress Tracking** - Detailed results for each candidate

---

## Request

### Headers
```
Content-Type: multipart/form-data
```

### Form Data Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `file` | File | **Yes** | - | CSV or XLSX file with candidates |
| `com_id` | string | No | - | Company ID for multi-tenancy and custom scoring weights |
| `saveToDatabase` | boolean | No | `true` | Whether to save candidates to database |
| `page` | number | No | `1` | Page number for pagination |
| `limit` | number | No | `10` | Number of candidates to process per page |

---

## CSV/XLSX File Format

### Required Columns
| Column Name | Alternatives | Required | Description |
|-------------|--------------|----------|-------------|
| `name` | `full_name`, `candidate_name` | **Yes** | Full name of candidate |
| `email` | `email_address` | No | Email (used for existing candidate detection) |
| `company` | `current_company`, `employer` | No | Current company name |
| `title` | `job_title`, `position`, `role` | No | Current job title |
| `location` | - | No | Location (optional) |

### Example CSV
```csv
name,email,company,title
John Doe,john@example.com,Google,Software Engineer
Jane Smith,jane@example.com,Microsoft,Product Manager
Bob Johnson,bob@example.com,Amazon,Data Scientist
Alice Williams,alice@example.com,Meta,UX Designer
```

### Example XLSX
Same columns as CSV, first row should be headers.

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "success": true,
        "candidateId": "uuid-123",
        "candidateInfo": {
          "name": "John Doe",
          "email": "john@example.com",
          "providedCompany": "Google",
          "providedTitle": "Software Engineer",
          "location": null
        },
        "linkedinProfile": {
          "profileUrl": "https://www.linkedin.com/in/johndoe",
          "name": "John Doe",
          "currentCompany": "Google",
          "currentTitle": "Senior Software Engineer",
          "headline": "Software Engineer at Google | AI & ML",
          "location": "San Francisco, CA",
          "summary": "Experienced software engineer...",
          "connections": 500,
          "skills": ["Python", "JavaScript", "React", "Node.js"],
          "education": [
            {
              "school": "Stanford University",
              "degree": "Bachelor's degree",
              "field": "Computer Science",
              "years": "2015 - 2019"
            }
          ],
          "certifications": [
            {
              "name": "AWS Certified Solutions Architect",
              "issuer": "Amazon Web Services",
              "date": "Issued Jan 2023"
            }
          ],
          "openToWork": false,
          "lastActive": "Recently active",
          "jobHistory": [
            {
              "company": "Google",
              "role": "Senior Software Engineer",
              "duration": "2 yrs"
            }
          ],
          "recentActivity": [],
          "profilePicture": "https://...",
          "industry": "Technology",
          "languages": ["English"]
        },
        "scoring": {
          "skillMatch": 8.5,
          "openToWork": 0,
          "jobStability": 9,
          "engagement": 7,
          "companyConsistency": 10,
          "overallScore": 7.8,
          "priority": "High"
        },
        "hireability": {
          "score": 81.2,
          "potentialToJoin": "High",
          "factors": {
            "openToWork": false,
            "companyMatch": true,
            "recentActivity": false,
            "skillsAvailable": true
          }
        },
        "insights": [
          "Strong technical skills in Python and JavaScript",
          "Stable employment history at top tech companies",
          "Good LinkedIn engagement and profile completeness"
        ],
        "companyDifference": "Same",
        "savedToDatabase": true,
        "isExistingCandidate": false,
        "processingTime": 28456
      },
      {
        "success": true,
        "candidateInfo": {
          "name": "Jane Smith",
          "email": "jane@example.com",
          "providedCompany": "Microsoft",
          "providedTitle": "Product Manager"
        },
        "existingCandidate": {
          "id": "uuid-456",
          "name": "Jane Smith",
          "email": "jane@example.com",
          "company": "Microsoft",
          "title": "Senior Product Manager",
          "score": 8.2,
          "priority": "High",
          "hireabilityScore": 85,
          "potentialToJoin": "High",
          "linkedinUrl": "https://www.linkedin.com/in/janesmith",
          "openToWork": true
        },
        "isExistingCandidate": true,
        "processingTime": 150
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalCandidates": 20,
      "candidatesPerPage": 10,
      "processedInThisPage": 10,
      "hasNextPage": true,
      "hasPrevPage": false,
      "nextPage": 2,
      "prevPage": null
    },
    "summary": {
      "totalCandidates": 20,
      "processedInThisPage": 10,
      "successful": 10,
      "failed": 0,
      "existingCandidates": 3,
      "newCandidates": 7,
      "savedToDatabase": true
    }
  },
  "message": "Processed 10 candidates from page 1 of 2"
}
```

---

## Response Fields

### Main Response
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the request was successful |
| `data.results` | array | Array of candidate results |
| `data.pagination` | object | Pagination metadata |
| `data.summary` | object | Processing summary |
| `message` | string | Status message |

### Result Object (New Candidate)
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether this candidate was processed successfully |
| `candidateId` | string\|null | Database ID if saved |
| `candidateInfo` | object | Provided candidate information |
| `linkedinProfile` | object\|null | Full LinkedIn profile data (see Quick Check API docs) |
| `scoring` | object | AI scoring results |
| `hireability` | object | Hireability calculation |
| `insights` | array | AI-generated insights |
| `companyDifference` | string | Company match status |
| `savedToDatabase` | boolean | Whether saved to database |
| `isExistingCandidate` | boolean | Always `false` for new candidates |
| `processingTime` | number | Processing time in milliseconds |

### Result Object (Existing Candidate)
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` |
| `candidateInfo` | object | Provided candidate information |
| `existingCandidate` | object | Existing candidate data from database |
| `isExistingCandidate` | boolean | Always `true` |
| `processingTime` | number | Processing time in milliseconds (~150ms) |

### Pagination Object
| Field | Type | Description |
|-------|------|-------------|
| `currentPage` | number | Current page number |
| `totalPages` | number | Total number of pages |
| `totalCandidates` | number | Total candidates in file |
| `candidatesPerPage` | number | Candidates per page |
| `processedInThisPage` | number | Candidates processed in this page |
| `hasNextPage` | boolean | Whether there's a next page |
| `hasPrevPage` | boolean | Whether there's a previous page |
| `nextPage` | number\|null | Next page number |
| `prevPage` | number\|null | Previous page number |

### Summary Object
| Field | Type | Description |
|-------|------|-------------|
| `totalCandidates` | number | Total candidates in file |
| `processedInThisPage` | number | Candidates processed in this page |
| `successful` | number | Successfully processed candidates |
| `failed` | number | Failed candidates |
| `existingCandidates` | number | Existing candidates detected |
| `newCandidates` | number | New candidates created |
| `savedToDatabase` | boolean | Whether saved to database |

---

## Examples

### Example 1: Basic Upload (cURL)

```bash
curl -X POST http://54.197.65.143:5000/api/bulk-quick-check \
  -F "file=@candidates.csv" \
  -F "saveToDatabase=true" \
  -F "page=1" \
  -F "limit=10"
```

### Example 2: With Company ID (cURL)

```bash
curl -X POST http://54.197.65.143:5000/api/bulk-quick-check \
  -F "file=@candidates.xlsx" \
  -F "com_id=Aimplify-123" \
  -F "saveToDatabase=true" \
  -F "page=1" \
  -F "limit=5"
```

### Example 3: Dry Run (No Save)

```bash
curl -X POST http://54.197.65.143:5000/api/bulk-quick-check \
  -F "file=@candidates.csv" \
  -F "saveToDatabase=false" \
  -F "page=1" \
  -F "limit=3"
```

### Example 4: JavaScript/TypeScript

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('com_id', 'Aimplify-123');
formData.append('saveToDatabase', 'true');
formData.append('page', '1');
formData.append('limit', '10');

const response = await fetch('http://54.197.65.143:5000/api/bulk-quick-check', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log(`Processed ${data.data.summary.processedInThisPage} candidates`);
console.log(`Existing: ${data.data.summary.existingCandidates}`);
console.log(`New: ${data.data.summary.newCandidates}`);
```

### Example 5: Python

```python
import requests

url = "http://54.197.65.143:5000/api/bulk-quick-check"
files = {'file': open('candidates.csv', 'rb')}
data = {
    'com_id': 'Aimplify-123',
    'saveToDatabase': 'true',
    'page': '1',
    'limit': '10'
}

response = requests.post(url, files=files, data=data, timeout=600)
result = response.json()

print(f"Processed: {result['data']['summary']['processedInThisPage']}")
print(f"Successful: {result['data']['summary']['successful']}")
print(f"Failed: {result['data']['summary']['failed']}")
```

---

## Pagination Workflow

### Processing a Large File (50 candidates)

**Step 1: Upload page 1**
```bash
curl -X POST http://54.197.65.143:5000/api/bulk-quick-check \
  -F "file=@candidates.csv" \
  -F "page=1" \
  -F "limit=10"
```
**Response:** Processes candidates 1-10

**Step 2: Upload page 2**
```bash
curl -X POST http://54.197.65.143:5000/api/bulk-quick-check \
  -F "file=@candidates.csv" \
  -F "page=2" \
  -F "limit=10"
```
**Response:** Processes candidates 11-20

**Continue until all pages are processed...**

### Checking Pagination Status

```javascript
const data = response.json();
const pagination = data.data.pagination;

console.log(`Page ${pagination.currentPage} of ${pagination.totalPages}`);
console.log(`Processed ${pagination.processedInThisPage} candidates`);

if (pagination.hasNextPage) {
  console.log(`Next page: ${pagination.nextPage}`);
  // Process next page...
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | Status | Description | Solution |
|------|--------|-------------|----------|
| `MISSING_FILE` | 400 | No file uploaded | Include file in form data |
| `EMPTY_FILE` | 400 | No valid candidates in file | Check CSV/XLSX format |
| `BULK_QUICK_CHECK_ERROR` | 500 | Processing failed | Check server logs |

### Individual Candidate Errors

If a candidate fails to process, it will be included in results with `success: false`:

```json
{
  "success": false,
  "candidateInfo": {
    "name": "Failed Candidate",
    "email": "failed@example.com"
  },
  "error": "LinkedIn search failed: Rate limit exceeded",
  "processingTime": 1234
}
```

The batch continues processing other candidates even if one fails.

---

## Performance & Best Practices

### Processing Times

| Scenario | Time per Candidate | Recommended Limit |
|----------|-------------------|-------------------|
| New candidate (with LinkedIn) | ~25-30 seconds | 5-10 per page |
| Existing candidate | ~150ms | 50-100 per page |
| No LinkedIn found | ~5-10 seconds | 10-20 per page |

### Recommendations

1. **Pagination**
   - Use `limit=10` for new candidates
   - Use `limit=50` if most are existing candidates
   - Process large files in multiple requests

2. **Timeout Settings**
   - Set HTTP timeout to at least 5 minutes for 10 candidates
   - Formula: `timeout = (limit * 30 seconds) + 60 seconds buffer`

3. **Rate Limiting**
   - Apify has rate limits (~100 requests/hour on free tier)
   - Space out requests if processing many pages
   - Consider upgrading Apify plan for higher limits

4. **Error Handling**
   - Check `summary.failed` count
   - Review failed candidates in results
   - Retry failed candidates separately

5. **Database Quota**
   - Monitor database usage (NeonDB free tier limits)
   - Use `saveToDatabase=false` for testing
   - Clean up test data regularly

---

## Comparison with Single Quick Check

| Feature | Bulk Quick Check | Single Quick Check |
|---------|------------------|-------------------|
| **Input** | CSV/XLSX file | JSON body |
| **Candidates** | Multiple | Single |
| **Pagination** | ✅ Yes | ❌ No |
| **Existing Detection** | ✅ Yes (by email) | ✅ Yes (by email) |
| **LinkedIn Enrichment** | ✅ Yes | ✅ Yes |
| **AI Scoring** | ✅ Yes | ✅ Yes |
| **Processing Time** | ~30s per candidate | ~30s total |
| **Use Case** | Batch processing | Quick lookup |

---

## Use Cases

### 1. Bulk Candidate Import
Upload a CSV of candidates from a job board or ATS system.

### 2. Resume Database Processing
Process existing resume database to enrich with LinkedIn data.

### 3. Event/Conference Attendees
Upload attendee list to quickly score all candidates.

### 4. Recruitment Campaign
Process multiple candidates from a recruitment campaign.

### 5. Existing Database Check
Upload list to check which candidates already exist in database.

---

## Troubleshooting

### Issue: Request Timeout

**Cause:** Processing too many candidates at once
**Solution:** Reduce `limit` parameter (try 5 or 10)

### Issue: No LinkedIn Data

**Cause:** LinkedIn profile not found or Apify rate limit
**Solution:** 
- Check candidate names and companies are accurate
- Verify Apify API token is valid
- Check Apify quota

### Issue: All Candidates Marked as Existing

**Cause:** Candidates already in database with same emails
**Solution:** This is expected behavior - existing candidates are returned immediately

### Issue: Slow Processing

**Cause:** LinkedIn enrichment takes time
**Solution:** 
- This is normal (~25-30s per new candidate)
- Use pagination to process in smaller batches
- Consider processing during off-peak hours

---

## API Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Max File Size | 50MB | Configurable in server |
| Max Candidates per File | Unlimited | Use pagination for large files |
| Recommended Batch Size | 10 | Balance between speed and reliability |
| HTTP Timeout | 5-10 minutes | Set on client side |
| Apify Rate Limit | ~100/hour | Free tier, upgradeable |
| OpenAI Rate Limit | ~60/minute | Depends on plan |

---

## Security

- File uploads are validated (CSV/XLSX only)
- Files are processed in memory (not saved to disk)
- Company ID (`com_id`) provides multi-tenancy isolation
- All data follows same security as single quick-check

---

## Related Endpoints

- `POST /api/quick-check` - Single candidate quick check
- `GET /api/candidates` - List all candidates
- `POST /api/upload-resumes` - Upload resume files (PDF/DOCX)

---

## Support

For issues or questions:
1. Check server logs: `pm2 logs talent-scout-app`
2. Verify server health: `GET /health`
3. Test with small batch first (limit=1)

---

*Last Updated: October 10, 2025*
*Version: 1.0*

