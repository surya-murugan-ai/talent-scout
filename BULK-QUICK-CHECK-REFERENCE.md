# Bulk Quick Check API - Quick Reference

## 🚀 Endpoint
```
POST /api/bulk-quick-check
```

## 📋 Required Parameters
- `file` - CSV or XLSX file

## 📝 Optional Parameters
- `com_id` - Company ID
- `saveToDatabase` - true/false (default: true)
- `page` - Page number (default: 1)
- `limit` - Candidates per page (default: 10)

---

## 📊 CSV Format

```csv
name,email,company,title
John Doe,john@example.com,Google,Software Engineer
Jane Smith,jane@example.com,Microsoft,Product Manager
```

**Required:** `name`
**Optional:** `email`, `company`, `title`, `location`

---

## 🧪 Quick Test

```bash
# Create test CSV
cat > test.csv << 'EOF'
name,email,company,title
John Doe,john@test.com,Google,Software Engineer
EOF

# Upload and process
curl -X POST http://54.197.65.143:5000/api/bulk-quick-check \
  -F "file=@test.csv" \
  -F "saveToDatabase=false" \
  -F "limit=1"
```

---

## 📤 Response Structure

```json
{
  "success": true,
  "data": {
    "results": [/* candidate results */],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "hasNextPage": true
    },
    "summary": {
      "totalCandidates": 50,
      "processedInThisPage": 10,
      "successful": 9,
      "failed": 1,
      "existingCandidates": 3,
      "newCandidates": 6
    }
  }
}
```

---

## ⏱️ Processing Times

| Type | Time | Notes |
|------|------|-------|
| New candidate | ~30s | LinkedIn + AI scoring |
| Existing candidate | ~150ms | Returns cached data |
| No LinkedIn | ~10s | AI scoring only |

---

## 🔄 Pagination Example

```bash
# Page 1
curl -X POST http://54.197.65.143:5000/api/bulk-quick-check \
  -F "file=@candidates.csv" \
  -F "page=1" \
  -F "limit=10"

# Page 2
curl -X POST http://54.197.65.143:5000/api/bulk-quick-check \
  -F "file=@candidates.csv" \
  -F "page=2" \
  -F "limit=10"
```

---

## ✅ Key Features

- ✅ Upload CSV/XLSX with multiple candidates
- ✅ Same scoring as single quick-check
- ✅ Detects existing candidates by email (fast!)
- ✅ Pagination for large files
- ✅ Full LinkedIn enrichment
- ✅ AI scoring with OpenAI GPT-4
- ✅ Batch processing with error handling

---

## ⚠️ Important Notes

1. **Timeout:** Set HTTP timeout to 5+ minutes for 10 candidates
2. **Rate Limits:** Apify free tier ~100 requests/hour
3. **Existing Candidates:** Detected by email, returned immediately
4. **Pagination:** Recommended limit=10 for new candidates
5. **File Size:** Max 50MB

---

## 🎯 Use Cases

- Bulk candidate import from CSV
- Process existing database
- Event attendee screening
- Recruitment campaign processing
- Check for existing candidates

---

## 📖 Full Documentation

See `BULK-QUICK-CHECK-API.md` for complete documentation.

---

*Quick Reference v1.0*

