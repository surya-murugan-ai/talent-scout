# 📤 File Upload Summary

## ✅ YES! You Can Upload CSV/XLSX Files

The **Bulk Quick Check API** (`/api/bulk-quick-check`) supports file uploads using `multipart/form-data`.

---

## 🎯 Quick Answer

**Question:** Can I upload CSV or XLSX and send through API?

**Answer:** **YES!** Both CSV and XLSX files are fully supported.

---

## 📦 What You Have Now

### 1. Sample CSV File
**Location:** `/home/ubuntu/apps/talent-scout/sample-candidates.csv`

Contains 10 sample Indian tech candidates ready for testing.

### 2. Test Script
**Location:** `/home/ubuntu/apps/talent-scout/test-bulk-upload.sh`

Automated script that:
- Uploads the sample CSV
- Processes 3 candidates at a time
- Shows formatted results
- Easy to customize

**Run it:**
```bash
./test-bulk-upload.sh
```

### 3. Complete Guide
**Location:** `/home/ubuntu/apps/talent-scout/BULK-UPLOAD-GUIDE.md`

7.6KB comprehensive guide covering:
- File format requirements
- Upload examples (CSV & XLSX)
- Pagination explained
- Response format
- Troubleshooting
- Testing checklist

---

## 🚀 How to Upload Files

### CSV Upload
```bash
curl -X POST http://54.197.65.143/api/bulk-quick-check \
  -F "file=@/path/to/candidates.csv" \
  -F "com_id=Aimplify-123" \
  -F "saveToDatabase=true" \
  -F "page=1" \
  -F "limit=5"
```

### XLSX Upload
```bash
curl -X POST http://54.197.65.143/api/bulk-quick-check \
  -F "file=@/path/to/candidates.xlsx" \
  -F "com_id=Aimplify-123" \
  -F "saveToDatabase=true" \
  -F "page=1" \
  -F "limit=5"
```

### Using JavaScript/Node.js
```javascript
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('candidates.csv'));
form.append('com_id', 'Aimplify-123');
form.append('saveToDatabase', 'true');
form.append('page', '1');
form.append('limit', '5');

fetch('http://54.197.65.143/api/bulk-quick-check', {
  method: 'POST',
  body: form
})
.then(res => res.json())
.then(data => console.log(data));
```

### Using Python
```python
import requests

url = 'http://54.197.65.143/api/bulk-quick-check'
files = {'file': open('candidates.csv', 'rb')}
data = {
    'com_id': 'Aimplify-123',
    'saveToDatabase': 'true',
    'page': 1,
    'limit': 5
}

response = requests.post(url, files=files, data=data)
print(response.json())
```

---

## 📊 File Format Requirements

### CSV Format
```csv
name,email,company,title,location
John Doe,john@example.com,Google,Software Engineer,San Francisco
Jane Smith,jane@example.com,Microsoft,Senior Developer,Seattle
```

### XLSX Format
Same columns as CSV, just in Excel format:

| name | email | company | title | location |
|------|-------|---------|-------|----------|
| John Doe | john@example.com | Google | Software Engineer | San Francisco |
| Jane Smith | jane@example.com | Microsoft | Senior Developer | Seattle |

### Required Columns
- ✅ `name` - Candidate's full name
- ✅ `email` - Email address (used for duplicate detection)
- ✅ `company` - Current company name
- ✅ `title` - Current job title
- ❌ `location` - Optional

**Note:** Column names are case-insensitive. `Name`, `name`, `NAME` all work.

---

## 🎯 What Happens When You Upload

1. **File Parsing** - CSV/XLSX is parsed and validated
2. **Pagination** - Candidates are split into pages (e.g., 5 per page)
3. **For Each Candidate:**
   - Check if email exists in database
   - If exists: Return existing data (fast ~150ms)
   - If new:
     - Search LinkedIn using Apify
     - Enrich profile data
     - AI analysis and scoring
     - Calculate hireability score
     - Save to database (if enabled)
4. **Return Results** - All processed candidates with scores

---

## ⏱️ Processing Time

| Scenario | Time |
|----------|------|
| 1 new candidate | ~25-30 seconds |
| 1 existing candidate | ~150ms |
| 5 new candidates | ~2-3 minutes |
| 10 new candidates | ~4-5 minutes |
| 5 existing candidates | ~1 second |

**Recommendation:** Start with `limit=3` for testing, then use `limit=5-10` for production.

---

## 📄 Response Format

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "candidate": {
          "name": "Surya Murugan",
          "email": "surya@example.com",
          "company": "Aimplify Tech",
          "title": "Full Stack Developer"
        },
        "existingCandidate": null,
        "linkedinProfile": {
          "profileUrl": "https://linkedin.com/in/...",
          "currentCompany": "Aimplify Tech",
          "currentTitle": "Full Stack Developer",
          "skills": ["JavaScript", "React", "Node.js"],
          "openToWork": true,
          "education": [...],
          "certifications": [...],
          "jobHistory": [...]
        },
        "analysis": {
          "skillMatch": 85,
          "openToWork": 90,
          "jobStability": 75,
          "engagement": 80,
          "companyConsistency": 70
        },
        "hireabilityScore": 80,
        "savedToDatabase": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalCandidates": 10,
      "processedInThisBatch": 5
    },
    "summary": {
      "successful": 5,
      "failed": 0,
      "alreadyExisted": 0
    }
  }
}
```

---

## 🔍 Duplicate Detection

The API automatically detects existing candidates by **email address**.

**If candidate exists in database:**
- Returns existing data immediately (~150ms)
- No LinkedIn search performed
- No AI analysis performed
- No duplicate entry created

**If candidate is new:**
- Full LinkedIn search
- Complete AI analysis
- Hireability score calculated
- Saved to database

---

## 📚 Related Documentation

1. **BULK-QUICK-CHECK-API.md** - Complete API reference (574 lines)
2. **BULK-UPLOAD-GUIDE.md** - This guide (7.6KB)
3. **QUICK-CHECK-API.md** - Single candidate API
4. **QUICK-CHECK-UPDATE.md** - Recent updates and changes

---

## ✅ Testing Checklist

- [ ] Run `./test-bulk-upload.sh` to test sample CSV
- [ ] Verify LinkedIn profiles are found
- [ ] Check AI scoring results
- [ ] Test pagination (page 1, then page 2)
- [ ] Test with existing candidates (upload same file twice)
- [ ] Test with your own CSV file
- [ ] Test with XLSX file
- [ ] Test with `saveToDatabase=false` (testing mode)
- [ ] Test with `saveToDatabase=true` (production mode)

---

## 🎉 Ready to Use!

Everything is set up and ready. Just run:

```bash
cd /home/ubuntu/apps/talent-scout
./test-bulk-upload.sh
```

Or upload your own file:

```bash
curl -X POST http://54.197.65.143/api/bulk-quick-check \
  -F "file=@your-candidates.csv" \
  -F "com_id=your-company-id" \
  -F "saveToDatabase=true" \
  -F "page=1" \
  -F "limit=5"
```

---

**Questions?** Check the detailed guides:
- `BULK-UPLOAD-GUIDE.md` - Complete upload guide
- `BULK-QUICK-CHECK-API.md` - Full API documentation
