# Eeezo Integration - Simple Guide

## What Your Colleague Needs to Do

### 1. Send Resume File with Company ID

Your colleague will send a POST request to your API with:
- **Resume file** (PDF or DOCX)
- **Company ID** (com_id)

### 2. API Endpoint

```
POST /api/eezo/upload-resume
```

### 3. Request Format

```javascript
// FormData request
const formData = new FormData();
formData.append('file', resumeFile);        // Resume file
formData.append('com_id', 'company-123');   // Company ID

fetch('/api/eezo/upload-resume', {
  method: 'POST',
  body: formData
});
```

### 4. What Happens Next

1. **File Upload**: Resume file is uploaded with company ID
2. **Processing**: Your system processes the resume using existing talent-AI pipeline
3. **Storage**: Data is stored in database with the company ID
4. **Enrichment**: LinkedIn enrichment runs in background
5. **Analysis**: AI scoring and analysis applied

### 5. Retrieving Data

Your colleague can get processed data by company ID:

```javascript
// Get all candidates for a company
GET /api/eezo/resume-data/company-123

// Response includes all processed candidate data
{
  "success": true,
  "data": {
    "comId": "company-123",
    "totalCandidates": 1,
    "candidates": [
      {
        "candidateId": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "skills": ["JavaScript", "React"],
        "score": 85.5,
        "priority": "High",
        "openToWork": true,
        // ... all other processed data
      }
    ]
  }
}
```

## Database Changes Made

### Added Company ID Column

```sql
-- Added to candidates table
ALTER TABLE candidates ADD COLUMN com_id VARCHAR;
```

### Optimized Schema

- Consolidated resume data into single table
- Added company ID tracking
- Optimized indexes for fast queries

## Testing

Use the test script:

```bash
node test-eezo-file-upload.js
```

## Example for Your Colleague

```javascript
// Eeezo integration example
const formData = new FormData();
formData.append('file', resumeFile);
formData.append('com_id', 'company-123');

const response = await fetch('https://your-api.com/api/eezo/upload-resume', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Upload result:', result);

// Later, retrieve processed data
const dataResponse = await fetch('https://your-api.com/api/eezo/resume-data/company-123');
const candidateData = await dataResponse.json();
console.log('Processed candidates:', candidateData.data.candidates);
```

## Key Points

1. **File Upload**: Eeezo sends resume file + company ID
2. **Processing**: Your existing talent-AI pipeline processes everything
3. **Storage**: Company ID is stored with all candidate data
4. **Retrieval**: Eeezo can get all candidates by company ID
5. **Complete Data**: All AI insights, scoring, and enrichment included

That's it! Simple file upload with company ID storage. 🚀
