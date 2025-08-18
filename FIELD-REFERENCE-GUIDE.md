# Field Reference Guide for Apify LinkedIn Search Integration

This guide explains all the fields you can include in your CSV/Excel files for the Talent Scout application and how they're used in the Apify LinkedIn search integration.

## 📋 Required Fields

### **Core Candidate Information**

| Field | Description | Example | Usage in Apify Search |
|-------|-------------|---------|----------------------|
| `name` | **REQUIRED** - Full name of the candidate | "John Smith" | Used for name-based search and matching |
| `email` | Email address | "john.smith@email.com" | Contact information, not used in search |
| `title` | Current job title | "Senior Software Engineer" | Used in `currentJobTitles` search parameter |
| `company` | Current company (can be LinkedIn URL or company name) | "https://www.linkedin.com/company/google" or "Google" | Extracted for company-based search |
| `location` | Geographic location | "San Francisco, CA" | Used in `locations` search parameter |

## 🔗 LinkedIn Integration Fields

### **LinkedIn Profile Information**

| Field | Description | Example | Usage |
|-------|-------------|---------|-------|
| `linkedinUrl` | Direct LinkedIn profile URL (optional) | "https://www.linkedin.com/in/john-smith-123" | If provided, used directly for enrichment |
| `skills` | Comma-separated list of skills | "JavaScript, React, Node.js, Python, AWS" | Used for skill matching and analysis |

## 📊 ATS (Applicant Tracking System) Fields

### **ATS Integration Data**

| Field | Description | Example | Usage |
|-------|-------------|---------|-------|
| `atsId` | Unique identifier from ATS | "ATS001" | Internal tracking |
| `selectionStatus` | Current status in hiring process | "Offered", "Selected", "Pending", "Rejected" | Status tracking |
| `selectionDate` | Date of status change | "2024-01-15" | Timeline tracking |
| `joiningOutcome` | Final outcome | "Accepted", "Declined", "No Communication" | Outcome analysis |
| `atsNotes` | Internal notes from ATS | "Strong technical skills, good cultural fit" | Additional context |

## 📞 Additional Contact Information

### **Contact Details**

| Field | Description | Example | Usage |
|-------|-------------|---------|-------|
| `phone` | Phone number | "+1-555-0123" | Contact information |
| `experience` | Years of experience | "5 years" | Experience level analysis |

## 🔍 How Fields Are Used in Apify Search

### **1. Company URL Extraction**
The system automatically extracts LinkedIn company URLs from the `company` field:
- **LinkedIn URL format**: `https://www.linkedin.com/company/google` → Used directly
- **Company name format**: `Google` → System will search for LinkedIn URL

### **2. Search Parameters Sent to Apify**

```typescript
// Example search input generated from CSV data
{
  "profileScraperMode": "Full",
  "maxItems": 20,
  "currentJobTitles": ["Senior Software Engineer"], // From 'title' field
  "locations": ["San Francisco, CA"], // From 'location' field
  "currentCompanies": ["https://www.linkedin.com/company/google"], // From 'company' field
  "firstNames": ["John"], // Extracted from 'name' field
  "lastNames": ["Smith"] // Extracted from 'name' field
}
```

### **3. Name Processing**
- **Input**: "John Smith"
- **Extracted**: `firstNames: ["John"]`, `lastNames: ["Smith"]`

### **4. Company Processing**
- **Input**: "https://www.linkedin.com/company/google"
- **Used**: Directly in `currentCompanies` and `pastCompanies` arrays

## 📝 Field Formatting Guidelines

### **Text Fields**
- Use quotes around fields containing commas: `"JavaScript, React, Node.js"`
- Escape quotes within text: `"He said \"Hello\""`

### **Date Fields**
- Use ISO format: `YYYY-MM-DD`
- Examples: `2024-01-15`, `2024-02-20`

### **URL Fields**
- Include full URLs: `https://www.linkedin.com/company/google`
- LinkedIn profile URLs: `https://www.linkedin.com/in/john-smith-123`

### **Skills Field**
- Comma-separated: `"JavaScript, React, Node.js, Python, AWS"`
- No spaces after commas for better parsing

## 🎯 Field Priority for Search Accuracy

### **High Priority (Used in Search)**
1. **`name`** - Primary search parameter
2. **`title`** - Job title matching
3. **`company`** - Company-based search
4. **`location`** - Geographic filtering

### **Medium Priority (Enhancement)**
5. **`linkedinUrl`** - Direct profile access
6. **`skills`** - Skill-based analysis

### **Low Priority (Tracking Only)**
7. **`email`** - Contact information
8. **`phone`** - Contact information
9. **`experience`** - Experience level
10. **ATS fields** - Internal tracking

## 🔧 Field Mapping Examples

### **Example 1: Complete Data**
```csv
name,title,company,location,linkedinUrl,skills
"John Smith","Senior Software Engineer","https://www.linkedin.com/company/google","San Francisco, CA","https://www.linkedin.com/in/john-smith-123","JavaScript, React, Node.js"
```

**Apify Search Input:**
```json
{
  "currentJobTitles": ["Senior Software Engineer"],
  "currentCompanies": ["https://www.linkedin.com/company/google"],
  "locations": ["San Francisco, CA"],
  "firstNames": ["John"],
  "lastNames": ["Smith"]
}
```

### **Example 2: Minimal Data**
```csv
name,title,company
"Sarah Johnson","Product Manager","Microsoft"
```

**Apify Search Input:**
```json
{
  "currentJobTitles": ["Product Manager"],
  "currentCompanies": ["Microsoft"],
  "firstNames": ["Sarah"],
  "lastNames": ["Johnson"]
}
```

## ⚠️ Common Field Issues

### **1. Missing Required Fields**
- **Issue**: Missing `name` field
- **Solution**: Always include candidate name

### **2. Invalid Company URLs**
- **Issue**: `company: "Google Inc."` (not LinkedIn URL)
- **Solution**: Use `"https://www.linkedin.com/company/google"` or just `"Google"`

### **3. Inconsistent Date Formats**
- **Issue**: `selectionDate: "01/15/2024"`
- **Solution**: Use `"2024-01-15"` format

### **4. Skills Formatting**
- **Issue**: `skills: "JavaScript,React,Node.js"` (no spaces)
- **Solution**: `skills: "JavaScript, React, Node.js"` (with spaces)

## 🚀 Best Practices

### **1. Data Quality**
- Use consistent formatting across all records
- Include as much information as possible
- Validate URLs before uploading

### **2. Company Information**
- Prefer LinkedIn company URLs when available
- Use consistent company naming
- Include both current and past companies if known

### **3. Location Data**
- Use consistent city/state format
- Include country for international candidates
- Use standard abbreviations

### **4. Skills**
- Use industry-standard skill names
- Separate with commas and spaces
- Include both technical and soft skills

## 📊 Expected Output

After processing, you'll get enriched data including:
- **LinkedIn Profile URL**: Found through search
- **Enhanced Skills**: From LinkedIn profile
- **Experience Details**: Job history from LinkedIn
- **Education**: Academic background
- **Connections**: Network size
- **Open to Work**: Status from LinkedIn
- **Profile Picture**: LinkedIn photo URL
- **Location**: Verified location
- **Certifications**: Professional certifications

This comprehensive field guide ensures you provide the right data for optimal LinkedIn search and enrichment results!
