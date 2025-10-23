# Candidate ID Upload Guide

## Overview
The TalentScout API now supports updating specific candidates by providing their `candidate_id` during resume upload. This allows developers to explicitly control which candidate to update instead of relying on automatic duplicate detection.

## Two Upload Modes

### 1. New Candidate Mode (Default)
When no `candidate_id` is provided, the system:
- Extracts email and LinkedIn URL from resume
- Checks for existing candidates with matching email/LinkedIn
- Creates new candidate if no duplicate found
- Updates existing candidate if duplicate found

### 2. Specific Candidate Mode (New)
When `candidate_id` is provided, the system:
- Validates the candidate exists and belongs to the company
- Always re-scrapes LinkedIn for latest data
- Updates the specific candidate with new resume data
- Merges data with priority: Latest LinkedIn > New Resume > Existing DB

## API Endpoints

### Single Resume Upload

**Endpoint:** `POST /api/eezo/upload-resume`

**New Candidate:**
```bash
curl -X POST "http://localhost:5001/api/eezo/upload-resume" \
  -F "com_id=company-123" \
  -F "file=@resume.pdf"
```

**Update Specific Candidate:**
```bash
curl -X POST "http://localhost:5001/api/eezo/upload-resume" \
  -F "com_id=company-123" \
  -F "candidate_id=candidate-456" \
  -F "file=@resume.pdf"
```

### Bulk Resume Upload

**Endpoint:** `POST /api/eezo/upload-bulk-resumes`

**New Candidates:**
```bash
curl -X POST "http://localhost:5001/api/eezo/upload-bulk-resumes" \
  -F "com_id=company-123" \
  -F "files=@resume1.pdf" \
  -F "files=@resume2.pdf"
```

**Update Specific Candidates:**
```bash
curl -X POST "http://localhost:5001/api/eezo/upload-bulk-resumes" \
  -F "com_id=company-123" \
  -F "candidate_ids=candidate-456" \
  -F "candidate_ids=candidate-789" \
  -F "files=@resume1.pdf" \
  -F "files=@resume2.pdf"
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Resume uploaded and processing started",
  "data": {
    "jobId": "processing-job-123",
    "candidateId": "candidate-456",
    "comId": "company-123",
    "status": "processing",
    "isUpdate": true,
    "updateType": "specific_candidate",
    "matchedBy": "candidate_id",
    "wasEnriched": true,
    "changes": {
      "title": {
        "old": "Software Engineer",
        "new": "Senior Software Engineer"
      },
      "linkedinConnections": {
        "old": 500,
        "new": 750
      }
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `isUpdate` | boolean | Whether this was an update to existing candidate |
| `updateType` | string | Type of update: `new_candidate`, `duplicate_detected`, `specific_candidate` |
| `matchedBy` | string | How candidate was matched: `email`, `linkedin`, `candidate_id` |
| `wasEnriched` | boolean | Whether LinkedIn data was refreshed |
| `changes` | object | Fields that changed (only for updates) |

## Error Handling

### Invalid Candidate ID
```json
{
  "success": false,
  "error": "Candidate not found or doesn't belong to this company",
  "code": "CANDIDATE_NOT_FOUND"
}
```

### Missing Company ID
```json
{
  "success": false,
  "error": "Company ID (com_id) is required",
  "code": "MISSING_COM_ID"
}
```

## Data Merging Priority

When updating a candidate, data is merged with the following priority:

1. **Latest LinkedIn Data** (highest priority)
   - Re-scraped from LinkedIn profile
   - Most current information

2. **New Resume Data** (medium priority)
   - Extracted from uploaded resume
   - User-provided information

3. **Existing DB Data** (lowest priority)
   - Previously stored data
   - Fallback values

## Use Cases

### 1. Regular Resume Processing
```bash
# Upload new resume - system handles duplicate detection
curl -X POST "http://localhost:5001/api/eezo/upload-resume" \
  -F "com_id=company-123" \
  -F "file=@resume.pdf"
```

### 2. Explicit Candidate Update
```bash
# Update specific candidate with new resume
curl -X POST "http://localhost:5001/api/eezo/upload-resume" \
  -F "com_id=company-123" \
  -F "candidate_id=candidate-456" \
  -F "file=@updated-resume.pdf"
```

### 3. Bulk Candidate Updates
```bash
# Update multiple specific candidates
curl -X POST "http://localhost:5001/api/eezo/upload-bulk-resumes" \
  -F "com_id=company-123" \
  -F "candidate_ids=candidate-456" \
  -F "candidate_ids=candidate-789" \
  -F "files=@resume1.pdf" \
  -F "files=@resume2.pdf"
```

## Testing

Run the test script to verify functionality:

```bash
node test-candidate-id-upload.js
```

The test script will:
- Test new candidate upload
- Test candidate update with candidate_id
- Test invalid candidate_id handling
- Test bulk upload scenarios
- Verify health checks

## Benefits

1. **Explicit Control**: Developers can specify exactly which candidate to update
2. **Data Freshness**: Always re-scrapes LinkedIn for latest information
3. **Change Tracking**: Shows exactly what fields changed during update
4. **Backward Compatibility**: Existing API calls continue to work
5. **Bulk Operations**: Support for updating multiple candidates at once

