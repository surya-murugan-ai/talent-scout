
# TalentScout API - Quick Reference

## Base URL
```
http://localhost:5000
```

## Essential Endpoints

### 🔍 Get Active Candidates
```bash
GET /api/candidates?com_id={company_id}&limit={limit}&offset={offset}
```

### 📋 Get Inactive Candidates  
```bash
GET /api/candidates/inactive?com_id={company_id}&limit={limit}&offset={offset}
```

### 👤 Get Single Candidate
```bash
GET /api/candidates/{candidate_id}?com_id={company_id}
```

### 🔄 Update Resume Status
```bash
PATCH /api/candidates/{candidate_id}/resume-status
Content-Type: application/json
{
  "status": "active|inactive",
  "com_id": "company_id"
}
```

### 📤 Upload Resume
```bash
POST /api/eezo/upload-resume
Content-Type: multipart/form-data
com_id: company_id
file: resume_file
```

### 📊 Get Company Data
```bash
GET /api/eezo/resume-data/{company_id}?limit={limit}&offset={offset}
```

### ⚡ Get Processing Status
```bash
GET /api/eezo/status/{company_id}
```

### 🏥 Health Check
```bash
GET /health
```

### 🔍 Debug Company IDs
```bash
GET /api/debug/com-ids
```

### 📊 Performance Stats
```bash
GET /api/performance/stats
```

### 📋 Processing Jobs
```bash
GET /api/jobs
GET /api/jobs/{job_id}
```

### ⚙️ Scoring Configuration
```bash
GET /api/scoring
POST /api/scoring
```

### 📤 Export Data
```bash
GET /api/export/csv?priority={priority}
```

### 🔗 LinkedIn Integration
```bash
POST /api/test-linkedin
PATCH /api/candidates/{id}/enrich
```

### 🗑️ Data Management
```bash
DELETE /api/clear-all-data
```

---

## Required Parameters

| Endpoint | Required Parameters |
|----------|-------------------|
| `/api/candidates` | `com_id` |
| `/api/candidates/{id}` | `com_id` |
| `/api/candidates/inactive` | `com_id` |
| `/api/candidates/{id}/resume-status` | `com_id` in body |
| `/api/eezo/upload-resume` | `com_id`, `resume` file |
| `/api/eezo/resume-data/{com_id}` | `com_id` in path |
| `/api/eezo/status/{com_id}` | `com_id` in path |

---

## Common Response Format

### Success
```json
{
  "success": true,
  "data": {...},
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 25,
    "hasMore": false
  },
  "company": "company_id"
}
```

### Error
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| `MISSING_COMPANY_ID` | Add `com_id` parameter |
| `CANDIDATE_NOT_FOUND` | Candidate doesn't exist or wrong company |
| `INVALID_STATUS` | Use "active" or "inactive" |
| `INVALID_FILE_TYPE` | Use PDF, DOCX, or DOC |
| `FILE_TOO_LARGE` | File > 50MB |

---

## PowerShell Examples

```powershell
# Get active candidates
Invoke-RestMethod -Uri "http://localhost:5000/api/candidates?com_id=eezo-123&limit=5" -Method GET

# Set candidate inactive
Invoke-RestMethod -Uri "http://localhost:5000/api/candidates/candidate-id/resume-status" -Method PATCH -Headers @{"Content-Type"="application/json"} -Body '{"status":"inactive","com_id":"eezo-123"}'

# Get inactive candidates
Invoke-RestMethod -Uri "http://localhost:5000/api/candidates/inactive?com_id=eezo-123" -Method GET

# Set candidate active
Invoke-RestMethod -Uri "http://localhost:5000/api/candidates/candidate-id/resume-status" -Method PATCH -Headers @{"Content-Type"="application/json"} -Body '{"status":"active","com_id":"eezo-123"}'
```

---

## JavaScript Examples

```javascript
// Get active candidates
const candidates = await fetch('http://localhost:5000/api/candidates?com_id=eezo-123&limit=10')
  .then(r => r.json());

// Update status
const update = await fetch('http://localhost:5000/api/candidates/candidate-id/resume-status', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'inactive', com_id: 'eezo-123' })
}).then(r => r.json());

// Upload resume
const formData = new FormData();
formData.append('com_id', 'eezo-123');
formData.append('resume', fileInput.files[0]);

const upload = await fetch('http://localhost:5000/api/eezo/upload-resume', {
  method: 'POST',
  body: formData
}).then(r => r.json());
```

---

## Pagination

- **Default limit**: 50 (candidates), 100 (inactive)
- **Default offset**: 0
- **Check `hasMore`**: true if more records available

```bash
# First page
?limit=10&offset=0

# Second page  
?limit=10&offset=10

# Third page
?limit=10&offset=20
```

---

## File Upload

- **Max size**: 50MB
- **Formats**: PDF, DOCX, DOC
- **Field name**: `file`
- **Company field**: `com_id`

```bash
curl -X POST "http://localhost:5000/api/eezo/upload-resume" \
  -F "com_id=company-123" \
  -F "file=@/path/to/file.pdf"
```
