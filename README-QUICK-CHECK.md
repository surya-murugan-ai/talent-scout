# Quick Check API - Documentation Index

## 📚 Documentation Files

### 1. [QUICK-CHECK-API.md](./QUICK-CHECK-API.md)
**Complete API Documentation**
- Full request/response specifications
- Code examples (cURL, JavaScript, Python)
- Field descriptions
- Error handling
- Troubleshooting guide
- Technical details

### 2. [QUICK-CHECK-REFERENCE.md](./QUICK-CHECK-REFERENCE.md)
**Quick Reference Guide**
- Minimal examples
- Parameter table
- Key points and warnings
- Quick test commands
- Status codes

### 3. [QUICK-CHECK-VS-RESUME-UPLOAD.md](./QUICK-CHECK-VS-RESUME-UPLOAD.md)
**Feature Comparison**
- Quick Check vs Resume Upload
- Scoring comparison
- Use cases for each
- Performance metrics
- When to use which endpoint

### 4. [SESSION-SUMMARY.md](./SESSION-SUMMARY.md)
**Implementation Summary**
- What was accomplished
- Technical issues resolved
- Test results
- Configuration details
- Known issues

---

## 🚀 Quick Start

### Test the API
```bash
curl -X POST http://54.197.65.143:5000/api/quick-check \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Surya Murugan",
    "company": "Aimplifytech",
    "title": "Full Stack Developer",
    "saveToDatabase": false
  }' \
  --max-time 60
```

### Key Points
- ⏱️ Takes 25-60 seconds
- ⛔ Don't include `location` parameter
- ✅ Returns full LinkedIn profile + AI scoring
- 🎯 Same scoring as resume upload

---

## ✅ What Quick Check Does

1. **Searches LinkedIn** - Finds candidate's profile via Apify
2. **Enriches Profile** - Gets full LinkedIn data (skills, job history, etc.)
3. **AI Scoring** - Uses OpenAI GPT-4 to analyze candidate
4. **Calculates Hireability** - Determines potential to join
5. **Saves to Database** - Optional (set `saveToDatabase: true`)

---

## 📊 Scoring Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Skill Match | 30% | Technical skills relevance |
| Open to Work | 40% | Actively seeking opportunities |
| Job Stability | 15% | Employment history patterns |
| Engagement | 15% | LinkedIn activity |
| Company Consistency | Bonus | Different company = higher score |

**Overall Score:** 0-100
**Priority:** High / Medium / Low
**Hireability:** 0-100
**Potential to Join:** High / Medium / Low

---

## 🔑 API Endpoints

### Quick Check
```
POST /api/quick-check
```
- Fast candidate lookup
- LinkedIn enrichment
- AI scoring
- Optional database save

### Resume Upload
```
POST /api/upload-resumes
```
- Bulk resume processing
- Resume text extraction
- Same scoring as Quick Check
- Always saves to database

### Other Endpoints
```
GET  /api/candidates          - List all candidates
GET  /api/candidates/:id      - Get candidate details
GET  /api/stats               - Get statistics
GET  /health                  - Health check
```

---

## ⚠️ Important Notes

### Known Issues
1. **Location Parameter** - Don't use it (causes 0 results)
2. **Processing Time** - Takes 25-60 seconds (set timeout accordingly)

### Best Practices
1. Always provide company name for better results
2. Set HTTP timeout to 60+ seconds
3. Check if `linkedinProfile` is null before accessing
4. Use `com_id` for multi-tenancy and custom scoring weights

---

## 🎯 Use Cases

### Quick Check is Perfect For:
- ✅ Quick candidate lookups
- ✅ API integrations
- ✅ Manual entry by HR team
- ✅ Verifying existing candidates
- ✅ Real-time scoring
- ✅ Event/conference candidate capture

### Resume Upload is Better For:
- ✅ Bulk processing (multiple resumes)
- ✅ Detailed resume text analysis
- ✅ Building candidate database
- ✅ Job application processing

---

## 📞 Support

### Check Server Status
```bash
pm2 status
pm2 logs talent-scout-app
```

### Test Health
```bash
curl http://54.197.65.143:5000/health
```

### Restart Server
```bash
pm2 restart talent-scout-app --update-env
```

---

## 🎉 Summary

**Quick Check = Same Scoring as Resume Upload**

Both use:
- ✅ Same LinkedIn enrichment
- ✅ Same AI analysis (OpenAI GPT-4)
- ✅ Same scoring algorithms
- ✅ Same hireability calculation
- ✅ Same database fields

**The only difference is the input method!**

---

*For detailed information, see the individual documentation files above.*

*Last Updated: October 8, 2025*
