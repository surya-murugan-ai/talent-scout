# 📤 Bulk Upload Guide - CSV/XLSX File Upload

## Quick Start

### 1️⃣ Sample Files Created

✅ **CSV File:** `/home/ubuntu/apps/talent-scout/sample-candidates.csv`
- Contains 10 sample candidates
- Ready to use for testing

✅ **Test Script:** `/home/ubuntu/apps/talent-scout/test-bulk-upload.sh`
- Automated test script
- Shows how to upload CSV files
- Includes result parsing

---

## 🚀 How to Test

### Option 1: Using the Test Script (Easiest)

```bash
cd /home/ubuntu/apps/talent-scout
./test-bulk-upload.sh
```

This will:
- Upload the sample CSV file
- Process 3 candidates (page 1, limit 3)
- Show detailed results
- NOT save to database (testing mode)

### Option 2: Manual cURL Command

```bash
curl -X POST http://54.197.65.143/api/bulk-quick-check \
  -F "file=@/home/ubuntu/apps/talent-scout/sample-candidates.csv" \
  -F "com_id=Aimplify-123" \
  -F "saveToDatabase=false" \
  -F "page=1" \
  -F "limit=3"
```

---

## 📋 CSV File Format

Your CSV file should have these columns (case-insensitive):

| Column | Required | Description |
|--------|----------|-------------|
| `name` | ✅ Yes | Full name of candidate |
| `email` | ✅ Yes | Email (used to detect duplicates) |
| `company` | ✅ Yes | Current company name |
| `title` | ✅ Yes | Current job title |
| `location` | ❌ No | Location (optional) |

**Example CSV:**
```csv
name,email,company,title,location
John Doe,john@example.com,Google,Software Engineer,San Francisco
Jane Smith,jane@example.com,Microsoft,Senior Developer,Seattle
```

---

## 📊 XLSX File Format

XLSX files work the same way! Just use the same column headers:

**Example XLSX Structure:**

| name | email | company | title | location |
|------|-------|---------|-------|----------|
| John Doe | john@example.com | Google | Software Engineer | San Francisco |
| Jane Smith | jane@example.com | Microsoft | Senior Developer | Seattle |

**Upload Command:**
```bash
curl -X POST http://54.197.65.143/api/bulk-quick-check \
  -F "file=@/path/to/candidates.xlsx" \
  -F "com_id=your-company-id" \
  -F "saveToDatabase=true" \
  -F "page=1" \
  -F "limit=5"
```

---

## 🔧 API Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file` | File | ✅ Yes | - | CSV or XLSX file |
| `com_id` | String | ✅ Yes | - | Your company ID |
| `saveToDatabase` | Boolean | ❌ No | `true` | Save candidates to DB |
| `page` | Number | ❌ No | `1` | Page number for pagination |
| `limit` | Number | ❌ No | `10` | Candidates per page |

---

## 📈 Understanding Pagination

If you have 50 candidates in your CSV:

**Page 1 (limit=10):** Processes candidates 1-10
```bash
curl -X POST http://54.197.65.143/api/bulk-quick-check \
  -F "file=@candidates.csv" \
  -F "com_id=Aimplify-123" \
  -F "page=1" \
  -F "limit=10"
```

**Page 2 (limit=10):** Processes candidates 11-20
```bash
curl -X POST http://54.197.65.143/api/bulk-quick-check \
  -F "file=@candidates.csv" \
  -F "com_id=Aimplify-123" \
  -F "page=2" \
  -F "limit=10"
```

**Page 3 (limit=10):** Processes candidates 21-30
```bash
curl -X POST http://54.197.65.143/api/bulk-quick-check \
  -F "file=@candidates.csv" \
  -F "com_id=Aimplify-123" \
  -F "page=3" \
  -F "limit=10"
```

---

## ⏱️ Processing Time

- **New Candidate:** ~25-30 seconds (LinkedIn search + AI analysis)
- **Existing Candidate:** ~150ms (database lookup only)
- **Batch of 5 new candidates:** ~2-3 minutes
- **Batch of 10 new candidates:** ~4-5 minutes

💡 **Tip:** Start with `limit=3` for testing, then increase to `limit=5` or `limit=10` for production.

---

## 🎯 Response Example

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
      "totalPages": 4,
      "totalCandidates": 10,
      "processedInThisBatch": 3
    },
    "summary": {
      "successful": 3,
      "failed": 0,
      "alreadyExisted": 0
    }
  }
}
```

---

## 🔍 Existing Candidate Detection

The API automatically checks if a candidate already exists in the database using their **email address**.

**If candidate exists:**
```json
{
  "candidate": { "name": "...", "email": "..." },
  "existingCandidate": {
    "id": 123,
    "name": "...",
    "email": "...",
    "hireability_score": 85,
    "linkedin_url": "...",
    "created_at": "2024-10-01T..."
  },
  "linkedinProfile": null,
  "analysis": null,
  "hireabilityScore": null,
  "savedToDatabase": false,
  "message": "Candidate already exists in database"
}
```

**If candidate is new:**
- Full LinkedIn search performed
- AI analysis completed
- Hireability score calculated
- Saved to database (if `saveToDatabase=true`)

---

## 🛠️ Customizing the Test Script

Edit `/home/ubuntu/apps/talent-scout/test-bulk-upload.sh`:

```bash
# Change these values:
COM_ID="your-company-id"        # Your company ID
SAVE_TO_DB="true"                # Set to true to save to database
PAGE=1                           # Page number
LIMIT=5                          # Candidates per page
```

---

## 📝 Creating Your Own CSV File

**Method 1: Using Excel/Google Sheets**
1. Create a spreadsheet with columns: name, email, company, title, location
2. Fill in your candidate data
3. Save as CSV or XLSX
4. Upload using the API

**Method 2: Using a Text Editor**
1. Create a file `my-candidates.csv`
2. Add header row: `name,email,company,title,location`
3. Add candidate rows
4. Save and upload

**Method 3: Export from Your System**
- Export candidate data from your existing system
- Ensure columns match the required format
- Upload directly

---

## ✅ Testing Checklist

- [ ] Test with 3 candidates first (`limit=3`)
- [ ] Verify LinkedIn profiles are found
- [ ] Check AI scoring results
- [ ] Test pagination (page 1, then page 2)
- [ ] Test with existing candidates (upload same file twice)
- [ ] Test with `saveToDatabase=false` first
- [ ] Then test with `saveToDatabase=true`
- [ ] Try both CSV and XLSX formats

---

## 🚨 Common Issues

### Issue: "No file uploaded"
**Solution:** Make sure you're using `-F "file=@/path/to/file.csv"` (note the `@` symbol)

### Issue: "Invalid file format"
**Solution:** Only CSV and XLSX files are supported. Check file extension.

### Issue: "Missing required fields"
**Solution:** Ensure your CSV has: name, email, company, title columns

### Issue: "Request timeout"
**Solution:** Reduce the `limit` parameter (try `limit=3` or `limit=5`)

### Issue: "LinkedIn profile not found"
**Solution:** This is normal for some candidates. The API will still save basic info.

---

## 📞 Support

For detailed API documentation, see:
- **BULK-QUICK-CHECK-API.md** - Complete API reference
- **QUICK-CHECK-API.md** - Single candidate API

---

## 🎉 You're Ready!

Run the test script to see it in action:

```bash
cd /home/ubuntu/apps/talent-scout
./test-bulk-upload.sh
```

Happy bulk processing! 🚀

