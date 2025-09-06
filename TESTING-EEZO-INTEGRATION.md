# Testing Eeezo Integration

## 🧪 How to Test the Eeezo Integration

### Method 1: HTML Test Page (Recommended)

1. **Open the HTML file**:
   ```bash
   # Open in your browser
   open test-eezo-upload.html
   # or
   start test-eezo-upload.html
   ```

2. **Fill in the form**:
   - **Company ID**: Enter any company ID (e.g., `company-123`)
   - **Resume File**: Select a PDF or DOCX file

3. **Upload and test**:
   - Click "Upload Resume"
   - Wait for processing
   - Click "Test Data Retrieval" to verify

### Method 2: Command Line Test

1. **Install dependencies** (if not already installed):
   ```bash
   npm install form-data
   ```

2. **Run the test script**:
   ```bash
   node test-eezo-api.js
   ```

3. **Make sure you have a test resume**:
   - Place a resume file at `./test_resume/Surya_Resume_002.pdf`
   - Or update the path in `test-eezo-api.js`

### Method 3: Manual API Testing

#### Upload Resume
```bash
curl -X POST http://localhost:5000/api/eezo/upload-resume \
  -F "file=@/path/to/resume.pdf" \
  -F "com_id=company-123"
```

#### Get Resume Data
```bash
curl http://localhost:5000/api/eezo/resume-data/company-123
```

#### Get Status
```bash
curl http://localhost:5000/api/eezo/status/company-123
```

## 🔧 Configuration

### Change Server URL
If your server is running on a different URL, update:

**In HTML file** (`test-eezo-upload.html`):
```javascript
const BASE_URL = 'http://your-server-url:port';
```

**In test script** (`test-eezo-api.js`):
```javascript
const BASE_URL = 'http://your-server-url:port';
```

## 📋 What to Test

### ✅ Upload Functionality
- [ ] File upload with company ID
- [ ] File type validation (PDF, DOCX)
- [ ] File size validation (50MB limit)
- [ ] Company ID storage

### ✅ Processing Pipeline
- [ ] Resume parsing
- [ ] Data extraction
- [ ] LinkedIn enrichment (background)
- [ ] AI scoring and analysis

### ✅ Data Retrieval
- [ ] Get candidates by company ID
- [ ] Status tracking
- [ ] Complete candidate data

### ✅ Error Handling
- [ ] Invalid file types
- [ ] Missing company ID
- [ ] Network errors
- [ ] Processing failures

## 🐛 Troubleshooting

### Common Issues

1. **"Network error"**:
   - Check if server is running
   - Verify BASE_URL is correct
   - Check CORS settings

2. **"File not found"**:
   - Place test resume at correct path
   - Update file path in test script

3. **"Upload failed"**:
   - Check file type (PDF/DOCX only)
   - Check file size (max 50MB)
   - Check server logs

4. **"Processing error"**:
   - Check database connection
   - Check LinkedIn API keys
   - Check server logs

### Debug Steps

1. **Check server logs**:
   ```bash
   # Look for Eeezo-related logs
   tail -f server.log | grep -i eezo
   ```

2. **Check database**:
   ```sql
   -- Check if candidates are being created
   SELECT com_id, name, eeezo_status, created_at 
   FROM candidates 
   WHERE com_id IS NOT NULL 
   ORDER BY created_at DESC;
   ```

3. **Check activities**:
   ```sql
   -- Check Eeezo activities
   SELECT * FROM activities 
   WHERE type LIKE 'eezo_%' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

## 📊 Expected Results

### Successful Upload Response
```json
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

### Successful Data Retrieval
```json
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
        "eeezoStatus": "completed",
        "enrichmentStatus": "completed"
      }
    ]
  }
}
```

## 🚀 Production Testing

For production testing:

1. **Update BASE_URL** to your production server
2. **Test with real resume files**
3. **Verify LinkedIn enrichment works**
4. **Check performance with multiple uploads**
5. **Test error scenarios**

## 📝 Test Checklist

- [ ] HTML test page works
- [ ] File upload succeeds
- [ ] Company ID is stored
- [ ] Resume parsing works
- [ ] LinkedIn enrichment runs
- [ ] AI scoring applied
- [ ] Data retrieval works
- [ ] Status tracking works
- [ ] Error handling works
- [ ] Performance is acceptable

## 🎯 Success Criteria

The integration is working correctly if:

1. ✅ Resume files upload successfully with company ID
2. ✅ Data is extracted and stored in database
3. ✅ LinkedIn enrichment runs in background
4. ✅ AI scoring and analysis is applied
5. ✅ Data can be retrieved by company ID
6. ✅ Status tracking shows progress
7. ✅ Error handling works properly

Happy testing! 🚀
