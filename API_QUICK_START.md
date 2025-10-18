# TalentScout API Quick Start

## 🚀 Base URL
```
http://your-droplet-ip:5000
```

## 🔑 Key Endpoints

### Health Checks
```bash
# Server health
GET /health

# Database health  
GET /api/database/health
```

### Resume Upload (With Duplicate Detection)

#### Single Upload
```bash
POST /api/eezo/upload-resume
Content-Type: multipart/form-data

Fields:
  - com_id: string (required) - Your company ID
  - file: file (required) - Resume PDF/DOCX
```

**Example:**
```bash
curl -X POST "http://your-ip:5000/api/eezo/upload-resume" \
  -F "com_id=company-123" \
  -F "file=@resume.pdf"
```

**Response (New Candidate):**
```json
{
  "success": true,
  "message": "Resume processed successfully",
  "data": {
    "candidateId": "uuid-abc-123",
    "comId": "company-123",
    "isUpdate": false,
    "wasEnriched": true
  }
}
```

**Response (Duplicate - Updated):**
```json
{
  "success": true,
  "message": "Resume updated successfully (matched by email)",
  "data": {
    "candidateId": "uuid-abc-123",
    "comId": "company-123",
    "isUpdate": true,
    "matchedBy": "email",
    "wasEnriched": true,
    "changes": {
      "linkedinUrl": {
        "from": "old-linkedin-url",
        "to": "new-linkedin-url"
      }
    }
  }
}
```

#### Bulk Upload (with WebSocket)
```bash
POST /api/eezo/upload-bulk-resumes
Content-Type: multipart/form-data

Fields:
  - com_id: string (required)
  - files: file[] (required) - Multiple resume files (max 20)
```

**Example:**
```bash
curl -X POST "http://your-ip:5000/api/eezo/upload-bulk-resumes" \
  -F "com_id=company-123" \
  -F "files=@resume1.pdf" \
  -F "files=@resume2.pdf" \
  -F "files=@resume3.pdf"
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk upload started",
  "data": {
    "sessionId": "bulk_1234567890_abc123",
    "comId": "company-123",
    "totalFiles": 3,
    "status": "processing",
    "websocketUrl": "ws://your-ip:5000/ws"
  }
}
```

### Get Candidates

#### Get Active Candidates
```bash
GET /api/candidates?com_id={company-id}&limit=50&offset=0
```

**Example:**
```bash
curl "http://your-ip:5000/api/candidates?com_id=company-123&limit=10"
```

#### Get Specific Candidate
```bash
GET /api/candidates/{candidate-id}?com_id={company-id}
```

#### Get Inactive Candidates
```bash
GET /api/candidates/inactive?com_id={company-id}
```

#### Get Resume Data by Company
```bash
GET /api/eezo/resume-data/{company-id}?limit=100&offset=0
```

#### Bulk Fetch Specific Candidates
```bash
POST /api/candidates/bulk
Content-Type: application/json

Body:
{
  "com_id": "company-123",
  "candidateIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

### Update Candidate

#### Update Resume Status (Active/Inactive)
```bash
PATCH /api/candidates/{candidate-id}/resume-status
Content-Type: application/json

Body:
{
  "com_id": "company-123",
  "status": "inactive"  # or "active"
}
```

**Example:**
```bash
curl -X PATCH "http://your-ip:5000/api/candidates/abc-123/resume-status" \
  -H "Content-Type: application/json" \
  -d '{
    "com_id": "company-123",
    "status": "inactive"
  }'
```

#### Update Candidate Scores
```bash
PATCH /api/candidates/{candidate-id}/scores
Content-Type: application/json

Body:
{
  "com_id": "company-123",
  "skillMatchScore": 8.5,
  "totalScore": 7.2
}
```

### Scoring Configuration

#### Get Scoring Weights
```bash
GET /api/scoring?com_id={company-id}
```

#### Update Scoring Weights
```bash
POST /api/scoring
Content-Type: application/json

Body:
{
  "com_id": "company-123",
  "openToWork": 30,
  "skillMatch": 30,
  "jobStability": 20,
  "platformEngagement": 20
}
```
*Note: Weights must sum to 100*

### WebSocket (Real-time Updates)

#### Connect
```javascript
const ws = new WebSocket('ws://your-ip:5000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.data);
};
```

#### Message Types
- `processing_started` - Upload session started
- `upload_progress` - Progress update (includes file count)
- `resume_completed` - Individual resume processed
- `upload_error` - Error processing a file
- `upload_complete` - All files processed

#### Get WebSocket Info
```bash
GET /api/websocket/info
```

### Bulk Upload Status

#### Get Session Status
```bash
GET /api/eezo/bulk-status/{session-id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "bulk_1234567890_abc123",
    "totalFiles": 3,
    "completedFiles": 2,
    "progress": 67,
    "candidates": [...],
    "errors": [...],
    "isComplete": false
  }
}
```

### Debug & Stats

#### Get All Company IDs
```bash
GET /api/debug/com-ids
```

#### Get Stats
```bash
GET /api/stats
```

#### Get Company Status
```bash
GET /api/eezo/status/{company-id}
```

## 🧪 Testing

### Quick Test Script
```bash
node test-production-api.js http://your-ip:5000 company-123
```

### Manual Test
```bash
# 1. Health check
curl http://your-ip:5000/health

# 2. Database check
curl http://your-ip:5000/api/database/health

# 3. Get candidates
curl "http://your-ip:5000/api/candidates?com_id=test-123"

# 4. Upload resume
curl -X POST "http://your-ip:5000/api/eezo/upload-resume" \
  -F "com_id=test-123" \
  -F "file=@resume.pdf"
```

## 📝 Duplicate Detection Behavior

| Scenario | Match Type | Action | Result |
|----------|-----------|--------|--------|
| Same email + LinkedIn | `email_and_linkedin` | Re-enrich from LinkedIn | Update existing |
| Same email, different LinkedIn | `email` | Update LinkedIn URL | Update existing |
| Different email, same LinkedIn | `linkedin` | Move old email to `alternateEmail` | Update existing |
| Both different | None | Create new | New candidate |

## 🔐 Company Isolation

All endpoints require `com_id` parameter for multi-tenancy:
- Each company's data is isolated
- `com_id` acts as a namespace
- Same email in different companies = different candidates

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "message": "Detailed message"
}
```

### Common Error Codes
- `MISSING_COM_ID` - Company ID required
- `MISSING_FILE` - File required
- `PROCESSING_ERROR` - Resume processing failed
- `CANDIDATE_NOT_FOUND` - Candidate doesn't exist
- `INVALID_STATUS` - Invalid status value

## 🎯 Rate Limits

- General API: 1000 requests / 15 minutes
- File Upload: 10 uploads / hour
- Bulk Upload: Max 20 files per request

## 📚 Full Documentation

- `API_DOCUMENTATION.md` - Complete API reference
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `IMPLEMENTATION_SUMMARY.md` - What was built

---

**Quick Links:**
- Health: `/health`
- Upload: `/api/eezo/upload-resume`
- Get Candidates: `/api/candidates?com_id=X`
- WebSocket: `ws://your-ip:5000/ws`

