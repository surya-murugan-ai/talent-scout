# TalentScout API Documentation

## Overview
The TalentScout API provides endpoints for managing candidate resumes with company-specific data isolation and comprehensive resume processing capabilities.

## Base URL
```
http://localhost:5000
```

## Authentication
Currently, the API operates in development mode without authentication. All endpoints require a `com_id` (company ID) parameter for data isolation.

## Common Response Format

### Success Response
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
  "company": "eezo-123",
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "message": "Detailed error message"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `MISSING_COMPANY_ID` | Company ID (com_id) is required |
| `MISSING_CANDIDATE_ID` | Candidate ID is required |
| `CANDIDATE_NOT_FOUND` | Candidate not found or doesn't belong to company |
| `INVALID_STATUS` | Status must be 'active' or 'inactive' |
| `INVALID_FILE_TYPE` | Unsupported file type |
| `FILE_TOO_LARGE` | File exceeds size limit |
| `PROCESSING_ERROR` | Resume processing failed |

---

## Endpoints

### 1. Health Check

**GET** `/health`

Check if the API server is running.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-09T02:28:11.798Z",
  "environment": "development",
  "uptime": 109.3717931
}
```

---

### 2. Get Active Candidates

**GET** `/api/candidates`

Retrieve active candidates for a specific company with pagination.

**Query Parameters:**
- `com_id` (required): Company ID
- `limit` (optional): Number of records per page (default: 50)
- `offset` (optional): Number of records to skip (default: 0)
- `priority` (optional): Filter by priority level

**Example Request:**
```bash
curl "http://localhost:5000/api/candidates?com_id=eezo-123&limit=10&offset=0"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "b40285bd-e9a8-4437-bd47-db6e018f9a35",
      "comId": "eezo-123",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1-555-0123",
      "title": "Software Engineer",
      "company": "Tech Corp",
      "location": "San Francisco, CA",
      "linkedinUrl": "https://linkedin.com/in/johndoe",
      "summary": "Experienced software engineer...",
      "skills": [...],
      "experience": [...],
      "education": [...],
      "score": 8.5,
      "priority": "High",
      "resumeStatus": "active",
      "createdAt": "2025-09-09T01:36:08.088Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "count": 1,
    "hasMore": false
  },
  "company": "eezo-123"
}
```

---

### 3. Get Single Candidate

**GET** `/api/candidates/:id`

Retrieve a specific candidate by ID with company validation.

**Query Parameters:**
- `com_id` (required): Company ID

**Example Request:**
```bash
curl "http://localhost:5000/api/candidates/b40285bd-e9a8-4437-bd47-db6e018f9a35?com_id=eezo-123"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "b40285bd-e9a8-4437-bd47-db6e018f9a35",
    "comId": "eezo-123",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "title": "Software Engineer",
    "company": "Tech Corp",
    "score": 8.5,
    "resumeStatus": "active"
  },
  "company": "eezo-123"
}
```

---

### 4. Get Inactive Candidates

**GET** `/api/candidates/inactive`

Retrieve inactive candidates for a specific company with pagination.

**Query Parameters:**
- `com_id` (required): Company ID
- `limit` (optional): Number of records per page (default: 100)
- `offset` (optional): Number of records to skip (default: 0)

**Example Request:**
```bash
curl "http://localhost:5000/api/candidates/inactive?com_id=eezo-123&limit=10&offset=0"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "candidate-id-here",
      "comId": "eezo-123",
      "name": "Jane Smith",
      "email": "jane.smith@example.com",
      "title": "Product Manager",
      "resumeStatus": "inactive",
      "createdAt": "2025-09-09T01:30:00.000Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "count": 1,
    "hasMore": false
  },
  "company": "eezo-123",
  "message": "Found 1 inactive candidates for company eezo-123"
}
```

---

### 5. Update Resume Status

**PATCH** `/api/candidates/:candidateId/resume-status`

Update a candidate's resume status (active/inactive) with company validation.

**Request Body:**
```json
{
  "status": "inactive",
  "com_id": "eezo-123"
}
```

**Example Request:**
```bash
curl -X PATCH "http://localhost:5000/api/candidates/b40285bd-e9a8-4437-bd47-db6e018f9a35/resume-status" \
  -H "Content-Type: application/json" \
  -d '{"status":"inactive","com_id":"eezo-123"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "candidateId": "b40285bd-e9a8-4437-bd47-db6e018f9a35",
    "name": "John Doe",
    "resumeStatus": "inactive",
    "comId": "eezo-123",
    "message": "Resume status updated to inactive"
  }
}
```

---

### 6. Get Specific Candidates by IDs

**POST** `/api/candidates/bulk`

Fetch specific candidates by their IDs and company ID. This endpoint allows the frontend to request only the candidates they need.

**Request Body:**
```json
{
  "candidateIds": ["7cab6c6f-a941-4d43-8766-d0d0cbf48367", "another-candidate-id"],
  "com_id": "eezo-123"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:5000/api/candidates/bulk" \
  -H "Content-Type: application/json" \
  -d '{"candidateIds":["7cab6c6f-a941-4d43-8766-d0d0cbf48367"],"com_id":"eezo-123"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comId": "eezo-123",
    "requestedIds": ["7cab6c6f-a941-4d43-8766-d0d0cbf48367"],
    "foundCandidates": 1,
    "candidates": [
      {
        "id": "7cab6c6f-a941-4d43-8766-d0d0cbf48367",
        "comId": "eezo-123",
        "name": "RAJESWARI.N",
        "email": "rajeerajeswari640@gmail.com",
        "phone": "+91 9346543414",
        "title": "Professional",
        "location": "Bengaluru",
        "score": 1.5,
        "priority": "Low",
        "resumeStatus": "active",
        "availability": "Immediate",
        "createdAt": "2025-09-09T05:07:01.515Z"
      }
    ]
  }
}
```

**Error Responses:**
- `400` - Missing company ID or candidate IDs
- `500` - Server error during fetch

---

### 7. Upload Resume (Eeezo Integration)

**POST** `/api/eezo/upload-resume`

Upload and process a resume file for a specific company.

**Request Body (multipart/form-data):**
- `com_id` (required): Company ID
- `file` (required): Resume file (PDF, DOCX, DOC)

**Example Request:**
```bash
curl -X POST "http://localhost:5000/api/eezo/upload-resume" \
  -F "com_id=eezo-123" \
  -F "file=@/path/to/resume.pdf"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comId": "eezo-123",
    "totalCandidates": 1,
    "candidates": [
      {
        "candidateId": "new-candidate-id",
        "comId": "eezo-123",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "title": "Software Engineer",
        "company": "Tech Corp",
        "score": 7.8,
        "priority": "Medium",
        "resumeStatus": "active",
        "processingTime": 15420,
        "createdAt": "2025-09-09T02:30:00.000Z"
      }
    ]
  }
}
```

---

### 7. Get Resume Data by Company ID

**GET** `/api/eezo/resume-data/:com_id`

Retrieve all resume data for a specific company.

**Path Parameters:**
- `com_id`: Company ID

**Query Parameters:**
- `limit` (optional): Number of records per page (default: 100)
- `offset` (optional): Number of records to skip (default: 0)
- `status` (optional): Filter by status (active/inactive)

**Example Request:**
```bash
curl "http://localhost:5000/api/eezo/resume-data/eezo-123?limit=10&offset=0"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comId": "eezo-123",
    "totalCandidates": 5,
    "candidates": [
      {
        "candidateId": "candidate-id-1",
        "comId": "eezo-123",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "title": "Software Engineer",
        "company": "Tech Corp",
        "score": 8.5,
        "priority": "High",
        "resumeStatus": "active"
      }
    ]
  }
}
```

---

### 8. Get Processing Status

**GET** `/api/eezo/status/:com_id`

Get the processing status for resumes uploaded by a company.

**Path Parameters:**
- `com_id`: Company ID

**Example Request:**
```bash
curl "http://localhost:5000/api/eezo/status/eezo-123"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comId": "eezo-123",
    "status": "completed",
    "totalCandidates": 5,
    "activeCandidates": 4,
    "inactiveCandidates": 1,
    "lastProcessed": "2025-09-09T02:30:00.000Z"
  }
}
```

---

### 9. Debug Company IDs

**GET** `/api/debug/com-ids`

Get all unique company IDs in the database with their candidate counts.

**Response:**
```json
{
  "success": true,
  "data": {
    "comIds": [
      {"com_id": "eezo-123", "count": 3},
      {"com_id": "193", "count": 13}
    ],
    "candidatesWithoutComId": 0,
    "totalUniqueComIds": 2
  }
}
```

---

### 10. Database Health Check

**GET** `/api/database/health`

Check database connectivity and health status.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-09-09T02:30:00.000Z"
}
```

---

### 11. Performance Statistics

**GET** `/api/performance/stats`

Get overall performance statistics.

**Response:**
```json
{
  "totalOperations": 150,
  "averageResponseTime": 245.5,
  "slowestOperation": "resume_processing",
  "memoryUsage": "45.2MB"
}
```

---

### 12. Processing Jobs

**GET** `/api/jobs`

Get all processing jobs.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "job-id",
      "fileName": "resume.pdf",
      "status": "completed",
      "progress": 100,
      "totalRecords": 1,
      "processedRecords": 1
    }
  ]
}
```

---

### 13. Scoring Configuration

**GET** `/api/scoring?com_id={company_id}`

Get current scoring weights configuration for a specific company.

**Query Parameters:**
- `com_id` (required): Company ID

**Example Request:**
```bash
curl "http://localhost:5000/api/scoring?com_id=eezo-123"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "config-id",
    "comId": "eezo-123",
    "openToWork": 30,
    "skillMatch": 25,
    "jobStability": 25,
    "platformEngagement": 20,
    "createdAt": "2025-09-10T12:00:00Z",
    "updatedAt": "2025-09-10T12:00:00Z"
  },
  "isDefault": false
}
```

**Note:** If no configuration exists for the company, returns default values with `isDefault: true`.

**POST** `/api/scoring`

Update scoring weights configuration for a specific company. Weights must sum to 100%.

**Request Body:**
```json
{
  "com_id": "eezo-123",
  "openToWork": 30,
  "skillMatch": 30,
  "jobStability": 20,
  "platformEngagement": 20
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:5000/api/scoring" \
  -H "Content-Type: application/json" \
  -d '{
    "com_id": "eezo-123",
    "openToWork": 30,
    "skillMatch": 30,
    "jobStability": 20,
    "platformEngagement": 20
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Scoring weights updated successfully",
  "data": {
    "id": "config-id",
    "comId": "eezo-123",
    "openToWork": 30,
    "skillMatch": 30,
    "jobStability": 20,
    "platformEngagement": 20,
    "createdAt": "2025-09-10T12:00:00Z",
    "updatedAt": "2025-09-10T13:00:00Z"
  }
}
```

**Validation Rules:**
- All weights must be between 0-100
- Total of all weights must equal 100
- `com_id` is required

**Individual Scoring Components:**

1. **Open to Work Score (0-10):**
   - LinkedIn `openToWork` flag: 10 points if true
   - Profile summary analysis for keywords like "immediate joiner", "open for opportunity"
   - Passive vs active job seeking signals

2. **Job Stability Score (0-10):**
   - Average tenure (last 2 jobs): 30% weight
   - Longest tenure: 20% weight  
   - Job changes in last 5 years: 25% weight
   - Employment gaps: 15% weight
   - Field/industry continuity: 10% weight

3. **Platform Engagement Score (0-10):**
   - LinkedIn last active: 40% weight
   - LinkedIn connections: 20% weight
   - LinkedIn activity/notes: 20% weight
   - Profile completeness: 20% weight

4. **Skill Match Score (0-10):**
   - Currently placeholder (basic skill count)
   - Future: JD-specific skill matching

**Note:** Individual scores are automatically calculated and stored in candidate records as `openToWorkScore`, `jobStabilityScore`, `platformEngagementScore`, and `skillMatchScore`.

---

### 14. Update Candidate Scores (External Team Integration)

**PATCH** `/api/candidates/:candidateId/scores`

Update candidate skill match and total scores. This endpoint is designed for external teams to update scores after their analysis.

**Request Body:**
```json
{
  "com_id": "eezo-123",
  "skillMatchScore": 8.5,
  "totalScore": 7.2,
  "jobDescription": "Software Engineer position"
}
```

**Parameters:**
- `candidateId` (path): Candidate ID
- `com_id` (body, required): Company ID
- `skillMatchScore` (body, optional): Skill match score (0-10)
- `totalScore` (body, optional): Total weighted score (0-10)
- `jobDescription` (body, optional): Job description used for scoring

**Example Request:**
```bash
curl -X PATCH "http://localhost:5000/api/candidates/7cab6c6f-a941-4d43-8766-d0d0cbf48367/scores" \
  -H "Content-Type: application/json" \
  -d '{
    "com_id": "eezo-123",
    "skillMatchScore": 8.5,
    "totalScore": 7.2,
    "jobDescription": "Software Engineer position"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "candidateId": "7cab6c6f-a941-4d43-8766-d0d0cbf48367",
    "name": "John Doe",
    "comId": "eezo-123",
    "skillMatchScore": 8.5,
    "totalScore": 7.2,
    "priority": "High",
    "updatedAt": "2025-09-10T12:00:00Z"
  },
  "message": "Candidate scores updated successfully"
}
```

**Validation Rules:**
- At least one score (`skillMatchScore` or `totalScore`) must be provided
- All scores must be between 0-10
- `com_id` is required
- Candidate must belong to the specified company

**Automatic Updates:**
- When `totalScore` is provided, the system automatically updates:
  - `priority` (High: ≥7, Medium: ≥5, Low: <5)
  - `hireabilityScore`
  - `potentialToJoin`

---

### 15. Export Candidates

**GET** `/api/export/csv`

Export candidates as CSV file.

**Query Parameters:**
- `priority` (optional): Filter by priority level

**Response:** CSV file download

---

### 15. Recent Activities

**GET** `/api/activities`

Get recent system activities.

**Query Parameters:**
- `limit` (optional): Number of activities to return (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "activity-id",
      "type": "upload",
      "message": "Resume uploaded",
      "details": "resume.pdf (245KB)",
      "timestamp": "2025-09-09T02:30:00.000Z"
    }
  ]
}
```

---

### 16. LinkedIn Integration

**POST** `/api/test-linkedin`

Test LinkedIn profile enrichment.

**Request Body:**
```json
{
  "linkedinUrl": "https://linkedin.com/in/username",
  "name": "John Doe",
  "company": "Tech Corp"
}
```

**PATCH** `/api/candidates/:id/enrich`

Enrich an existing candidate with LinkedIn data.

**Request Body:**
```json
{
  "linkedinUrl": "https://linkedin.com/in/username"
}
```

---

### 17. Data Management

**DELETE** `/api/clear-all-data`

Clear all data from the system.

**Response:**
```json
{
  "success": true,
  "message": "All data cleared successfully"
}
```

---

### 18. Dashboard Statistics

**GET** `/api/stats`

Get dashboard statistics.

**Response:**
```json
{
  "totalCandidates": 150,
  "activeCandidates": 120,
  "inactiveCandidates": 30,
  "averageScore": 7.2,
  "topPriority": "High"
}
```

---

### 19. Bulk Resume Upload with WebSocket

**POST** `/api/eezo/upload-bulk-resumes`

Upload multiple resume files with real-time WebSocket progress updates.

**Request Body (multipart/form-data):**
- `com_id` (required): Company ID
- `files` (required): Array of resume files (PDF, DOCX, DOC) - max 20 files

**Example Request:**
```bash
curl -X POST "http://localhost:5000/api/eezo/upload-bulk-resumes" \
  -F "com_id=eezo-123" \
  -F "files=@resume1.pdf" \
  -F "files=@resume2.docx" \
  -F "files=@resume3.doc"
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk upload started",
  "data": {
    "sessionId": "bulk_1694256789_abc123def",
    "comId": "eezo-123",
    "totalFiles": 3,
    "status": "processing",
    "websocketUrl": "ws://localhost:5000/ws"
  }
}
```

---

### 20. Bulk Upload Session Status

**GET** `/api/eezo/bulk-status/:sessionId`

Get the current status of a bulk upload session.

**Path Parameters:**
- `sessionId`: Session ID returned from bulk upload

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "bulk_1694256789_abc123def",
    "comId": "eezo-123",
    "totalFiles": 3,
    "completedFiles": 2,
    "progress": 67,
    "candidates": [
      {
        "candidateId": "uuid-1",
        "name": "John Doe",
        "email": "john@example.com",
        "score": 8.5,
        "priority": "High"
      }
    ],
    "errors": [
      {
        "fileName": "resume3.doc",
        "error": "Invalid file format"
      }
    ],
    "isComplete": false
  }
}
```

---

### 21. WebSocket Connection Info

**GET** `/api/websocket/info`

Get WebSocket server information and connection details.

**Response:**
```json
{
  "success": true,
  "data": {
    "websocketUrl": "ws://localhost:5000/ws",
    "connectedClients": 2,
    "activeSessions": 1,
    "messageTypes": [
      "processing_started",
      "upload_progress",
      "resume_completed",
      "upload_error",
      "upload_complete"
    ]
  }
}
```

---

## WebSocket Integration

### Connection

Connect to the WebSocket server for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:5000/ws');

ws.onopen = function(event) {
  console.log('Connected to WebSocket');
};

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Received:', data.type, data.data);
};
```

### Message Types

#### 1. Processing Started
```json
{
  "type": "processing_started",
  "data": {
    "message": "Connected to TalentScout WebSocket",
    "clientId": "client_1694256789_abc123"
  },
  "timestamp": "2025-09-09T02:30:00.000Z"
}
```

#### 2. Upload Progress
```json
{
  "type": "upload_progress",
  "data": {
    "sessionId": "bulk_1694256789_abc123def",
    "comId": "eezo-123",
    "totalFiles": 3,
    "completedFiles": 1,
    "currentFile": "resume1.pdf",
    "progress": 33
  },
  "timestamp": "2025-09-09T02:30:00.000Z",
  "sessionId": "bulk_1694256789_abc123def"
}
```

#### 3. Resume Completed
```json
{
  "type": "resume_completed",
  "data": {
    "sessionId": "bulk_1694256789_abc123def",
    "comId": "eezo-123",
    "candidate": {
      "candidateId": "uuid-1",
      "name": "John Doe",
      "email": "john@example.com",
      "score": 8.5,
      "priority": "High"
    },
    "totalCompleted": 1,
    "totalFiles": 3
  },
  "timestamp": "2025-09-09T02:30:00.000Z",
  "sessionId": "bulk_1694256789_abc123def"
}
```

#### 4. Upload Error
```json
{
  "type": "upload_error",
  "data": {
    "sessionId": "bulk_1694256789_abc123def",
    "comId": "eezo-123",
    "fileName": "resume3.doc",
    "error": "Invalid file format",
    "totalCompleted": 2,
    "totalFiles": 3
  },
  "timestamp": "2025-09-09T02:30:00.000Z",
  "sessionId": "bulk_1694256789_abc123def"
}
```

#### 5. Upload Complete
```json
{
  "type": "upload_complete",
  "data": {
    "sessionId": "bulk_1694256789_abc123def",
    "comId": "eezo-123",
    "totalCandidates": 2,
    "totalErrors": 1,
    "candidates": [...],
    "errors": [...]
  },
  "timestamp": "2025-09-09T02:30:00.000Z",
  "sessionId": "bulk_1694256789_abc123def"
}
```

### Frontend Integration Example

```javascript
class TalentScoutWebSocket {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.candidates = [];
    this.errors = [];
  }

  connect() {
    this.ws = new WebSocket('ws://localhost:5000/ws');
    
    this.ws.onopen = () => {
      console.log('Connected to TalentScout WebSocket');
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
    };
  }

  handleMessage(data) {
    switch (data.type) {
      case 'upload_progress':
        this.updateProgress(data.data);
        break;
      case 'resume_completed':
        this.addCandidate(data.data.candidate);
        break;
      case 'upload_error':
        this.addError(data.data.fileName, data.data.error);
        break;
      case 'upload_complete':
        this.completeUpload(data.data);
        break;
    }
  }

  async uploadBulkResumes(comId, files) {
    const formData = new FormData();
    formData.append('com_id', comId);
    
    for (let file of files) {
      formData.append('files', file);
    }
    
    const response = await fetch('http://localhost:5000/api/eezo/upload-bulk-resumes', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    if (result.success) {
      this.sessionId = result.data.sessionId;
      console.log('Upload started:', this.sessionId);
    }
  }

  updateProgress(data) {
    // Update UI progress bar
    const progress = (data.completedFiles / data.totalFiles) * 100;
    console.log(`Progress: ${progress}% - ${data.currentFile}`);
  }

  addCandidate(candidate) {
    this.candidates.push(candidate);
    // Update UI candidate list
    console.log('New candidate:', candidate.name);
  }

  addError(fileName, error) {
    this.errors.push({ fileName, error });
    // Update UI error list
    console.log('Error:', fileName, error);
  }

  completeUpload(data) {
    console.log('Upload complete:', data.totalCandidates, 'candidates');
    // Update UI with final results
  }
}

// Usage
const talentScout = new TalentScoutWebSocket();
talentScout.connect();

// Upload files
const fileInput = document.getElementById('files');
talentScout.uploadBulkResumes('eezo-123', fileInput.files);
```

---

## Data Models

### Candidate Object
```json
{
  "id": "string (UUID)",
  "comId": "string",
  "name": "string",
  "email": "string",
  "phone": "string",
  "title": "string",
  "company": "string",
  "location": "string",
  "linkedinUrl": "string",
  "githubUrl": "string",
  "portfolioUrl": "string",
  "summary": "string",
  "skills": "array",
  "experience": "array",
  "education": "array",
  "projects": "array",
  "achievements": "array",
  "certifications": "array",
  "languages": "array",
  "interests": "array",
  "score": "number",
  "priority": "string (High/Medium/Low)",
  "hireabilityScore": "number",
  "potentialToJoin": "string",
  "hireabilityFactors": "array",
  "openToWorkScore": "number (0-10)",
  "skillMatchScore": "number (0-10)",
  "jobStabilityScore": "number (0-10)",
  "platformEngagementScore": "number (0-10)",
  "yearsOfExperience": "number",
  "salary": "string",
  "availability": "string",
  "remotePreference": "string",
  "visaStatus": "string",
  "resumeStatus": "string (active/inactive)",
  "source": "string",
  "dataSource": "string",
  "enrichmentStatus": "string",
  "eeezoStatus": "string",
  "confidence": "number",
  "processingTime": "number",
  "createdAt": "string (ISO 8601)"
}
```

### Pagination Object
```json
{
  "limit": "number",
  "offset": "number",
  "count": "number",
  "hasMore": "boolean"
}
```

---

## Rate Limits

- **General API**: 1000 requests per 15 minutes per IP
- **File Upload**: 10 uploads per hour per IP
- **Polling Endpoints**: 60 requests per minute per IP

---

## CORS Policy

The API supports CORS for the following origins in development:
- `http://localhost:3000`
- `http://localhost:5000`

Allowed methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`

---

## File Upload Limits

- **Maximum file size**: 50MB
- **Supported formats**: PDF, DOCX, DOC
- **Maximum files per request**: 20

---

## Examples

### Complete Workflow Example

1. **Upload a resume:**
```bash
curl -X POST "http://localhost:5000/api/eezo/upload-resume" \
  -F "com_id=company-123" \
  -F "resume=@resume.pdf"
```

2. **Get active candidates:**
```bash
curl "http://localhost:5000/api/candidates?com_id=company-123&limit=10"
```

3. **Set a candidate to inactive:**
```bash
curl -X PATCH "http://localhost:5000/api/candidates/candidate-id/resume-status" \
  -H "Content-Type: application/json" \
  -d '{"status":"inactive","com_id":"company-123"}'
```

4. **Get inactive candidates:**
```bash
curl "http://localhost:5000/api/candidates/inactive?com_id=company-123"
```

5. **Set candidate back to active:**
```bash
curl -X PATCH "http://localhost:5000/api/candidates/candidate-id/resume-status" \
  -H "Content-Type: application/json" \
  -d '{"status":"active","com_id":"company-123"}'
```

---

## Testing

### PowerShell Examples

```powershell
# Get active candidates
Invoke-RestMethod -Uri "http://localhost:5000/api/candidates?com_id=eezo-123&limit=5" -Method GET

# Update resume status
Invoke-RestMethod -Uri "http://localhost:5000/api/candidates/candidate-id/resume-status" -Method PATCH -Headers @{"Content-Type"="application/json"} -Body '{"status":"inactive","com_id":"eezo-123"}'

# Get inactive candidates
Invoke-RestMethod -Uri "http://localhost:5000/api/candidates/inactive?com_id=eezo-123" -Method GET
```

### JavaScript/Fetch Examples

```javascript
// Get active candidates
const response = await fetch('http://localhost:5000/api/candidates?com_id=eezo-123&limit=10');
const data = await response.json();

// Update resume status
const updateResponse = await fetch('http://localhost:5000/api/candidates/candidate-id/resume-status', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'inactive',
    com_id: 'eezo-123'
  })
});
const updateData = await updateResponse.json();
```

---

## Support

For issues or questions, please check the server logs for detailed error messages. The API includes comprehensive error handling with specific error codes to help with debugging.
