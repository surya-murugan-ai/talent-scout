# Eeezo Integration Documentation

## Overview

This document describes the integration between TalentScout and Eeezo systems. The integration allows Eeezo to upload resumes with company IDs and retrieve processed candidate data.

## Database Optimization

### Before (Issues)
- **Data Duplication**: Both `candidates` and `resume_data` tables stored similar information
- **Complex Updates**: LinkedIn enrichment required updating both tables separately
- **Inconsistent Data**: Data could become out of sync between tables
- **Performance Issues**: Multiple JOINs required for complete candidate data
- **Maintenance Overhead**: Two tables to maintain for essentially the same entity

### After (Optimized)
- **Single Table**: Consolidated all data into the `candidates` table
- **Atomic Updates**: All data updates happen in one place
- **Better Performance**: No JOINs required for complete data
- **Data Consistency**: No risk of data getting out of sync
- **Simpler Queries**: Single table queries are faster
- **Better Indexing**: More efficient indexes on single table

## Database Schema Changes

### New Fields Added to `candidates` Table

```sql
-- Eeezo Integration Fields
com_id VARCHAR                    -- Company ID from Eeezo system
eezo_resume_url TEXT             -- Original resume URL from Eeezo
eezo_upload_date TIMESTAMP       -- When resume was uploaded via Eeezo
eezo_status TEXT DEFAULT 'uploaded' -- uploaded, processed, enriched, completed

-- Consolidated Resume Data Fields
filename TEXT                    -- Original filename
summary TEXT                     -- Professional summary
raw_text TEXT                    -- Raw extracted text
experience JSONB DEFAULT '[]'    -- Work experience array
education JSONB DEFAULT '[]'     -- Education array
projects JSONB DEFAULT '[]'      -- Projects array
achievements JSONB DEFAULT '[]'  -- Achievements array
interests JSONB DEFAULT '[]'     -- Interests array

-- Data Source and Processing
data_source TEXT DEFAULT 'resume' -- resume, linkedin, manual, eeezo, ats
enrichment_status TEXT DEFAULT 'pending' -- pending, in_progress, completed, failed
enrichment_date TIMESTAMP        -- When LinkedIn enrichment was completed
enrichment_source TEXT           -- dev_fusion, harvestapi, manual
```

### Indexes for Performance

```sql
-- Primary indexes
CREATE INDEX idx_candidates_com_id ON candidates(com_id);
CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_candidates_name ON candidates(name);

-- Composite indexes for common queries
CREATE INDEX idx_candidates_com_id_status ON candidates(com_id, enrichment_status);
CREATE INDEX idx_candidates_source_status ON candidates(source, enrichment_status);
CREATE INDEX idx_candidates_com_id_created ON candidates(com_id, created_at);
```

## API Endpoints

### 1. Upload Resume with Company ID

**Endpoint**: `POST /api/eezo/upload-resume`

**Request**:
```javascript
// FormData
{
  file: File,           // Resume file (PDF, DOCX) - REQUIRED
  com_id: string        // Company ID from Eeezo - REQUIRED
}
```

**Response**:
```javascript
{
  "success": true,
  "message": "Resume uploaded and processing started",
  "data": {
    "jobId": "uuid",
    "candidateId": "uuid",
    "comId": "company-123",
    "status": "processing"
  }
}
```

**Error Response**:
```javascript
{
  "error": "Company ID (com_id) is required",
  "code": "MISSING_COM_ID"
}
```

### 2. Get Resume Data by Company ID

**Endpoint**: `GET /api/eezo/resume-data/:com_id`

**Query Parameters**:
- `status` (optional): Filter by eeezo_status
- `limit` (optional): Number of records to return (default: 100)
- `offset` (optional): Number of records to skip (default: 0)

**Response**:
```javascript
{
  "success": true,
  "data": {
    "comId": "company-123",
    "totalCandidates": 5,
    "candidates": [
      {
        "candidateId": "uuid",
        "comId": "company-123",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "title": "Software Engineer",
        "company": "Tech Corp",
        "location": "San Francisco, CA",
        "linkedinUrl": "https://linkedin.com/in/johndoe",
        "githubUrl": "https://github.com/johndoe",
        "portfolioUrl": "https://johndoe.dev",
        "summary": "Experienced software engineer...",
        "skills": ["JavaScript", "React", "Node.js"],
        "experience": [...],
        "education": [...],
        "projects": [...],
        "achievements": [...],
        "certifications": [...],
        "languages": [...],
        "interests": [...],
        "score": 85.5,
        "priority": "High",
        "openToWork": true,
        "hireabilityScore": 8.2,
        "potentialToJoin": "High",
        "enrichmentStatus": "completed",
        "eezoStatus": "completed",
        "confidence": 92.5,
        "processingTime": 1500,
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:35:00Z"
      }
    ]
  }
}
```

### 3. Get Processing Status

**Endpoint**: `GET /api/eezo/status/:com_id`

**Response**:
```javascript
{
  "success": true,
  "data": {
    "comId": "company-123",
    "status": {
      "totalCandidates": 10,
      "uploaded": 2,
      "processed": 3,
      "enriched": 4,
      "completed": 1,
      "pendingEnrichment": 2,
      "failedEnrichment": 0
    }
  }
}
```

### 4. Update Candidate Status

**Endpoint**: `PATCH /api/eezo/candidate/:candidateId/status`

**Request**:
```javascript
{
  "eezoStatus": "completed",  // uploaded, processed, enriched, completed
  "notes": "Candidate selected for interview"
}
```

**Response**:
```javascript
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "eezoStatus": "completed",
    "notes": "Candidate selected for interview",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

## Processing Flow

### 1. Upload Phase
1. Eeezo sends POST request with resume file and `com_id`
2. System validates input and creates processing job
3. Resume file is parsed using existing talent-AI pipeline
4. Data extracted and `com_id` stored in database
5. Candidate record created with `eezoStatus: 'uploaded'`

### 2. Processing Phase
1. LinkedIn enrichment starts in background
2. `enrichmentStatus: 'in_progress'`
3. LinkedIn data fetched and merged with resume data
4. `enrichmentStatus: 'completed'`, `eezoStatus: 'enriched'`

### 3. Analysis Phase
1. AI analysis performed on enriched data
2. Scoring and prioritization calculated using existing algorithms
3. `eezoStatus: 'completed'`

### 4. Retrieval Phase
1. Eeezo can query data by `com_id`
2. Filter by status, pagination supported
3. Complete candidate data returned with all talent-AI insights

## Error Handling

### Common Error Codes

- `MISSING_COM_ID`: Company ID not provided
- `MISSING_FILE`: Resume file not provided
- `INVALID_FILE_TYPE`: Unsupported file type
- `PROCESSING_ERROR`: Resume processing failed
- `FETCH_ERROR`: Data retrieval failed
- `STATUS_ERROR`: Status check failed
- `UPDATE_ERROR`: Status update failed

### File Requirements

- **File Types**: Supports PDF (.pdf) and Word documents (.docx, .doc)
- **File Size**: Maximum 50MB
- **Upload Method**: FormData with multipart/form-data encoding
- **Required Fields**: Both `file` and `com_id` are required

### Error Response Format

```javascript
{
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "message": "Detailed error information"
}
```

## Security Considerations

1. **Input Validation**: All inputs are validated and sanitized
2. **File Type Validation**: Only PDF and DOCX files accepted
3. **File Size Limits**: 50MB maximum file size
4. **Rate Limiting**: Upload endpoints have rate limits
5. **Error Handling**: Sensitive information not exposed in errors

## Performance Optimizations

1. **Database Indexes**: Optimized for common query patterns
2. **Background Processing**: LinkedIn enrichment runs asynchronously
3. **Caching**: Processing results cached for repeated queries
4. **Pagination**: Large result sets paginated
5. **Connection Pooling**: Database connections pooled

## Testing

Run the integration tests:

```bash
node test-eezo-integration.js
```

The test script will:
1. Upload a test resume with company ID
2. Wait for processing
3. Retrieve the processed data
4. Check processing status

## Migration Guide

### Running the Migration

```bash
# Apply the database migration
psql -d your_database -f drizzle/0004_optimize_candidates_table.sql
```

### Data Migration

The migration script will:
1. Add new columns to `candidates` table
2. Migrate data from `resume_data` table (if exists)
3. Create optimized indexes
4. Add constraints for data integrity

### Rollback (if needed)

```sql
-- Remove Eeezo-specific columns
ALTER TABLE candidates DROP COLUMN IF EXISTS com_id;
ALTER TABLE candidates DROP COLUMN IF EXISTS eeezo_resume_url;
ALTER TABLE candidates DROP COLUMN IF EXISTS eeezo_upload_date;
ALTER TABLE candidates DROP COLUMN IF EXISTS eeezo_status;

-- Remove consolidated fields
ALTER TABLE candidates DROP COLUMN IF EXISTS filename;
ALTER TABLE candidates DROP COLUMN IF EXISTS summary;
ALTER TABLE candidates DROP COLUMN IF EXISTS raw_text;
ALTER TABLE candidates DROP COLUMN IF EXISTS experience;
ALTER TABLE candidates DROP COLUMN IF EXISTS education;
ALTER TABLE candidates DROP COLUMN IF EXISTS projects;
ALTER TABLE candidates DROP COLUMN IF EXISTS achievements;
ALTER TABLE candidates DROP COLUMN IF EXISTS interests;

-- Remove processing fields
ALTER TABLE candidates DROP COLUMN IF EXISTS data_source;
ALTER TABLE candidates DROP COLUMN IF EXISTS enrichment_status;
ALTER TABLE candidates DROP COLUMN IF EXISTS enrichment_date;
ALTER TABLE candidates DROP COLUMN IF EXISTS enrichment_source;
```

## Monitoring and Logging

### Activity Logging

All Eeezo operations are logged in the `activities` table:

- `eezo_upload`: Resume uploaded via Eeezo
- `eezo_error`: Processing errors
- `eezo_status_update`: Status changes

### Monitoring Queries

```sql
-- Check Eeezo processing status
SELECT 
  com_id,
  eeezo_status,
  COUNT(*) as count
FROM candidates 
WHERE com_id IS NOT NULL 
GROUP BY com_id, eeezo_status;

-- Check enrichment status
SELECT 
  com_id,
  enrichment_status,
  COUNT(*) as count
FROM candidates 
WHERE com_id IS NOT NULL 
GROUP BY com_id, enrichment_status;

-- Recent Eeezo activities
SELECT * FROM activities 
WHERE type LIKE 'eezo_%' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Support

For issues or questions regarding the Eeezo integration:

1. Check the error logs in the `activities` table
2. Verify database migration was applied correctly
3. Test with the provided test script
4. Check API endpoint responses for error codes

## Future Enhancements

1. **Webhook Support**: Notify Eeezo when processing completes
2. **Batch Processing**: Support multiple resume uploads
3. **Advanced Filtering**: More sophisticated query options
4. **Real-time Updates**: WebSocket support for live status updates
5. **Analytics**: Processing metrics and performance dashboards
