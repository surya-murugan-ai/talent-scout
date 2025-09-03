# Resume Parsing Feature

## Overview
TalentScout now supports automated resume parsing for both PDF and DOCX files, extracting candidate information and integrating it seamlessly with the existing talent acquisition pipeline.

## Supported File Types
- **PDF** - Portable Document Format resumes
- **DOCX** - Microsoft Word document resumes  
- **CSV** - Comma-separated values (existing)
- **Excel** - XLSX/XLS spreadsheets (existing)

## Features

### 📄 Resume Text Extraction
- **PDF Parsing**: Uses `pdf-parse` library to extract text from PDF resumes
- **DOCX Parsing**: Uses `mammoth` library to extract text from Word documents
- **Error Handling**: Graceful fallback and detailed error messages

### 🧠 Smart Data Extraction
The system automatically extracts:

- **Name**: Multiple pattern matching for candidate names
- **Email**: Email address validation and extraction
- **Phone**: International phone number formats
- **LinkedIn URL**: LinkedIn profile URL extraction and validation
- **Skills**: Keyword matching from 50+ technology skills
- **Experience**: Years of experience parsing
- **Job Title**: Current position identification
- **Company**: Current employer extraction
- **Location**: Geographic location parsing

### 📊 Confidence Scoring
Each parsed resume receives a confidence score (0-100%) based on:
- Name extraction (30 points)
- Email found (25 points)
- Phone number (15 points)
- Skills identified (20 points)
- Job title (10 points)

### 🔄 Integration with Existing Pipeline
- **LinkedIn Enrichment**: Found candidates are enriched with LinkedIn data
- **AI Scoring**: Uses the same AI scoring system as CSV uploads
- **Database Storage**: All extracted data stored in PostgreSQL
- **Processing Jobs**: Same job tracking as other file types

## Usage

### Upload Interface
1. **Drag & Drop**: Support for multiple files (up to 20)
2. **File Browser**: Click to select files
3. **Progress Tracking**: Real-time upload and processing status
4. **Error Reporting**: Detailed error messages for failed parsing

### API Endpoints
```bash
# Upload multiple files (including resumes)
POST /api/upload
Content-Type: multipart/form-data
Files: files[] (CSV, Excel, PDF, DOCX)
```

### File Processing Flow
1. **Upload**: Files uploaded via drag-drop or file browser
2. **Validation**: File type and size validation
3. **Text Extraction**: PDF/DOCX text extraction
4. **Data Parsing**: Smart field extraction using regex patterns
5. **LinkedIn Search**: Search for LinkedIn profiles if not provided
6. **LinkedIn Enrichment**: Enhance profiles with LinkedIn data
7. **AI Analysis**: Score candidates using AI
8. **Database Storage**: Store all extracted and enriched data

## Configuration

### Supported Skills Keywords
The system recognizes 50+ technology skills including:
- **Languages**: JavaScript, TypeScript, Python, Java, C++, C#, PHP, Ruby, Go, etc.
- **Frontend**: React, Angular, Vue, HTML, CSS, Bootstrap, Tailwind, etc.
- **Backend**: Node.js, Express, Django, Flask, Spring, Laravel, etc.
- **Databases**: PostgreSQL, MySQL, MongoDB, Redis, SQLite, etc.
- **Cloud/DevOps**: AWS, Azure, GCP, Docker, Kubernetes, Jenkins, etc.

### File Limits
- **Maximum File Size**: 50MB per file
- **Maximum Files**: 20 files per upload batch
- **Supported Extensions**: .pdf, .docx, .csv, .xlsx, .xls

## Error Handling

### Common Errors
- **Unsupported Format**: DOC files not supported (convert to DOCX)
- **Corrupted Files**: Invalid or corrupted PDF/DOCX files
- **Large Files**: Files exceeding 50MB limit
- **Text Extraction**: Files with no extractable text

### Fallback Behavior
- **Partial Data**: System saves any successfully extracted fields
- **Manual Review**: Low confidence scores flagged for manual review
- **Error Logging**: Detailed error logs for troubleshooting

## Dependencies

### Backend
```json
{
  "pdf-parse": "^1.1.1",
  "mammoth": "^1.6.0",
  "@types/pdf-parse": "^1.1.4"
}
```

### Installation
```bash
npm install pdf-parse mammoth @types/pdf-parse
```

## Example Output

### Parsed Resume Data
```json
{
  "name": "John Doe",
  "email": "john.doe@email.com",
  "phone": "+1-555-123-4567",
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "skills": ["JavaScript", "React", "Node.js", "Python"],
  "experience": "5 years",
  "title": "Senior Software Engineer",
  "company": "Tech Corp",
  "location": "San Francisco, CA",
  "confidence": 95,
  "processingTime": 1250
}
```

### Processing Results
```json
{
  "message": "Successfully uploaded 3 file(s)",
  "totalFiles": 3,
  "processingResults": [
    {
      "filename": "john_doe_resume.pdf",
      "success": true,
      "jobId": "job-123-456"
    },
    {
      "filename": "jane_smith_resume.docx", 
      "success": true,
      "jobId": "job-123-457"
    }
  ]
}
```

## Future Enhancements
- **OCR Support**: Scan image-based PDFs
- **ZIP Support**: Bulk resume upload via ZIP files
- **Custom Skills**: User-defined skill keywords
- **Template Recognition**: Resume template-specific parsing
- **Multi-language**: Support for non-English resumes
