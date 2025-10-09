# Eeezo Integration Example

## How Eeezo Should Integrate

### 1. Eeezo Uploads Resume URL

When a user uploads a resume in Eeezo, Eeezo should make a POST request to your system:

```javascript
// Eeezo makes this request
const response = await fetch('https://your-talent-scout-api.com/api/eezo/upload-resume', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    com_id: 'company-123',                    // Company ID from Eeezo
    resume_url: 'https://example.com/resume.pdf'  // URL to the resume file
  })
});

const result = await response.json();
console.log('Upload result:', result);
```

### 2. Your System Processes the Resume

Your system will:
1. Download the resume from the provided URL
2. Parse it using your existing talent-AI pipeline
3. Extract all candidate information
4. Start LinkedIn enrichment in background
5. Apply AI scoring and analysis
6. Store everything with the company ID

### 3. Eeezo Retrieves Processed Data

When Eeezo needs the processed candidate data:

```javascript
// Eeezo retrieves processed data
const response = await fetch('https://your-talent-scout-api.com/api/eezo/resume-data/company-123');
const result = await response.json();

console.log('Processed candidates:', result.data.candidates);
```

### 4. Complete Data Structure Returned

Eeezo will receive comprehensive candidate data including:

```javascript
{
  "success": true,
  "data": {
    "comId": "company-123",
    "totalCandidates": 1,
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
        "summary": "Experienced software engineer with 5+ years...",
        "skills": ["JavaScript", "React", "Node.js", "Python"],
        "experience": [
          {
            "jobTitle": "Senior Software Engineer",
            "company": "Tech Corp",
            "duration": "2020-2024",
            "description": "Led development of web applications..."
          }
        ],
        "education": [
          {
            "degree": "Bachelor of Computer Science",
            "university": "University of California",
            "year": "2019"
          }
        ],
        "projects": [...],
        "achievements": [...],
        "certifications": [...],
        "score": 85.5,                    // AI-calculated score
        "priority": "High",               // AI-determined priority
        "openToWork": true,               // LinkedIn analysis
        "hireabilityScore": 8.2,          // Hireability assessment
        "potentialToJoin": "High",        // Likelihood to join
        "enrichmentStatus": "completed",  // LinkedIn enrichment status
        "eezoStatus": "completed",        // Processing status
        "confidence": 92.5,               // Data extraction confidence
        "processingTime": 1500,           // Processing time in ms
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:35:00Z"
      }
    ]
  }
}
```

## Integration Benefits for Eeezo

### 1. **Complete Talent Intelligence**
- Resume parsing with 90%+ accuracy
- LinkedIn profile enrichment
- AI-powered scoring and prioritization
- Skills extraction and matching
- Experience analysis

### 2. **Automated Processing**
- No manual data entry required
- Background LinkedIn enrichment
- Real-time status tracking
- Error handling and retry logic

### 3. **Rich Candidate Profiles**
- Comprehensive candidate data
- Skills and experience analysis
- Education and certification tracking
- Project and achievement details
- Contact information and social links

### 4. **AI-Powered Insights**
- Candidate scoring (0-100)
- Priority ranking (High/Medium/Low)
- Hireability assessment
- "Open to Work" detection
- Potential to join analysis

## Error Handling

### Common Scenarios

```javascript
// 1. Invalid URL
{
  "error": "Failed to download resume from URL: 404 Not Found",
  "code": "DOWNLOAD_ERROR"
}

// 2. Unsupported file type
{
  "error": "Invalid file type. Only PDF and DOCX files are supported.",
  "code": "INVALID_FILE_TYPE"
}

// 3. Processing failure
{
  "error": "Failed to extract data from resume",
  "code": "PROCESSING_ERROR"
}
```

## Status Tracking

Eeezo can track processing status:

```javascript
// Check processing status
const response = await fetch('https://your-talent-scout-api.com/api/eezo/status/company-123');
const status = await response.json();

console.log('Processing status:', status.data.status);
// {
//   "totalCandidates": 5,
//   "uploaded": 1,
//   "processed": 2,
//   "enriched": 1,
//   "completed": 1,
//   "pendingEnrichment": 0,
//   "failedEnrichment": 0
// }
```

## Best Practices for Eeezo

### 1. **URL Requirements**
- Use HTTPS URLs when possible
- Ensure URLs are publicly accessible
- Include proper file extensions (.pdf, .docx)
- Keep file sizes under 50MB

### 2. **Error Handling**
- Implement retry logic for failed downloads
- Handle timeout scenarios
- Provide user feedback for processing status
- Log errors for debugging

### 3. **Data Management**
- Store candidate IDs for future reference
- Implement pagination for large result sets
- Cache processed data to avoid re-processing
- Handle data updates and status changes

### 4. **User Experience**
- Show processing progress to users
- Provide estimated completion times
- Allow users to check status manually
- Send notifications when processing completes

## Testing the Integration

Use the provided test script:

```bash
node test-eezo-url-processing.js
```

This will test:
1. URL-based resume upload
2. Data retrieval
3. Status checking
4. Error handling

## Support and Monitoring

### Activity Logs
All Eeezo operations are logged in the system:
- Upload attempts and results
- Processing progress and completion
- Error occurrences and resolutions
- Performance metrics

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

-- Recent Eeezo activities
SELECT * FROM activities 
WHERE type LIKE 'eezo_%' 
ORDER BY created_at DESC 
LIMIT 10;
```

This integration provides Eeezo with powerful talent intelligence capabilities while maintaining the existing talent-AI processing pipeline.
