# HarvestAPI Results Storage

This document explains how the system now automatically saves all raw results from the harvestapi LinkedIn scraper.

## 📁 **Storage Structure**

When you use the LinkedIn search or enrichment features, the system automatically creates the following directory structure:

```
harvestapi-results/
├── harvestapi_John_Doe_Software_Engineer_2025-01-20T10-30-45-123Z.json
├── harvestapi_Profile_enrichment_for_John_Doe_2025-01-20T10-31-12-456Z.json
├── harvestapi_Surya_Murugan_Full_Stack_2025-01-20T10-32-00-789Z.json
└── summaries/
    ├── harvestapi_John_Doe_Software_Engineer_2025-01-20T10-30-45-123Z_summary.json
    ├── harvestapi_Profile_enrichment_for_John_Doe_2025-01-20T10-31-12-456Z_summary.json
    └── harvestapi_Surya_Murugan_Full_Stack_2025-01-20T10-32-00-789Z_summary.json
```

## 🎯 **What Gets Saved**

### **1. Raw HarvestAPI Results**
- **Location**: `harvestapi-results/` directory
- **Format**: Complete JSON response from harvestapi
- **Content**: All raw data exactly as returned by the API
- **Naming**: `harvestapi_{search_query}_{timestamp}.json`

### **2. Results Summary**
- **Location**: `harvestapi-results/summaries/` directory
- **Format**: Condensed JSON with key information
- **Content**: Profile overview, counts, and metadata
- **Naming**: `{original_filename}_summary.json`

## 📊 **File Contents**

### **Raw Results File Structure**
```json
{
  "timestamp": "2025-01-20T10:30:45.123Z",
  "searchQuery": "John Doe Software Engineer TechCorp San Francisco",
  "rawData": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "headline": "Software Engineer at TechCorp",
      "linkedinUrl": "https://www.linkedin.com/in/john-doe-123456789",
      "location": {
        "linkedinText": "San Francisco, CA"
      },
      "currentPosition": [
        {
          "companyName": "TechCorp",
          "position": "Software Engineer"
        }
      ],
      "skills": [
        {
          "name": "JavaScript",
          "positions": ["Software Engineer at TechCorp"]
        }
      ],
      "experience": [...],
      "education": [...],
      // ... all other harvestapi fields
    }
  ],
  "metadata": {
    "totalResults": 1,
    "source": "harvestapi/linkedin-profile-search",
    "savedAt": "2025-01-20T10:30:45.123Z"
  }
}
```

### **Summary File Structure**
```json
{
  "timestamp": "2025-01-20T10:30:45.123Z",
  "searchQuery": "John Doe Software Engineer TechCorp San Francisco",
  "totalResults": 1,
  "profiles": [
    {
      "index": 1,
      "name": "John Doe",
      "headline": "Software Engineer at TechCorp",
      "location": "San Francisco, CA",
      "currentCompany": "TechCorp",
      "currentPosition": "Software Engineer",
      "linkedinUrl": "https://www.linkedin.com/in/john-doe-123456789",
      "connectionsCount": "500+",
      "skillsCount": 15,
      "experienceCount": 3,
      "educationCount": 2
    }
  ],
  "originalFile": "harvestapi_John_Doe_Software_Engineer_2025-01-20T10-30-45-123Z.json"
}
```

## 🔄 **When Results Are Saved**

### **1. LinkedIn Profile Search**
- **Trigger**: When calling `searchProfiles()` or `searchProfilesWithApify()`
- **Saved**: All search results from harvestapi
- **Query**: Search parameters (name, title, company, location)

### **2. LinkedIn Profile Enrichment**
- **Trigger**: When calling `enrichProfile()`
- **Saved**: Detailed profile data from harvestapi
- **Query**: Profile URL or search parameters

## 🚀 **How to Use**

### **1. Upload CSV and Process**
```bash
# Start the application
npm run dev

# Upload a CSV file through the web interface
# The system will automatically save all harvestapi results
```

### **2. Check Saved Results**
```bash
# View the results directory
ls harvestapi-results/

# View a specific result file
cat harvestapi-results/harvestapi_John_Doe_Software_Engineer_2025-01-20T10-30-45-123Z.json

# View the summary
cat harvestapi-results/summaries/harvestapi_John_Doe_Software_Engineer_2025-01-20T10-30-45-123Z_summary.json
```

### **3. Test the Storage**
```bash
# Run the test script
node test-harvestapi-storage.js
```

## 📈 **Benefits**

### **1. Data Preservation**
- ✅ All harvestapi responses are preserved
- ✅ No data loss during processing
- ✅ Historical search results available

### **2. Analysis & Debugging**
- ✅ Raw data for detailed analysis
- ✅ Easy comparison between searches
- ✅ Debug API responses and issues

### **3. Research & Development**
- ✅ Real data for testing and development
- ✅ Sample data for documentation
- ✅ Performance analysis

### **4. Compliance & Audit**
- ✅ Complete audit trail of API calls
- ✅ Data retention for compliance
- ✅ Search history tracking

## 🔧 **Configuration**

### **Storage Location**
- **Default**: `./harvestapi-results/` (relative to project root)
- **Customizable**: Modify the `resultsDir` path in `saveHarvestApiResults()`

### **File Naming**
- **Format**: `harvestapi_{sanitized_query}_{timestamp}.json`
- **Sanitization**: Special characters removed, spaces replaced with underscores
- **Timestamp**: ISO format with colons and periods replaced with hyphens

### **Summary Generation**
- **Automatic**: Created for every raw result file
- **Location**: `harvestapi-results/summaries/`
- **Content**: Key profile information and metadata

## 🛠️ **File Management**

### **Automatic Cleanup**
Currently, files are saved indefinitely. You can implement cleanup by:

1. **Age-based cleanup**: Remove files older than X days
2. **Size-based cleanup**: Limit total directory size
3. **Count-based cleanup**: Keep only the latest N files

### **Manual Cleanup**
```bash
# Remove all results
rm -rf harvestapi-results/

# Remove old files (older than 30 days)
find harvestapi-results/ -name "*.json" -mtime +30 -delete
```

## 📝 **Logging**

The system logs all storage operations:

```
✅ HarvestAPI results saved to: /path/to/harvestapi-results/harvestapi_John_Doe_Software_Engineer_2025-01-20T10-30-45-123Z.json
📋 Results summary saved to: /path/to/harvestapi-results/summaries/harvestapi_John_Doe_Software_Engineer_2025-01-20T10-30-45-123Z_summary.json
```

## 🎯 **Next Steps**

1. **Upload your CSV file** and process candidates
2. **Check the `harvestapi-results/` directory** for saved files
3. **Review the raw data** to understand the harvestapi response format
4. **Use the summaries** for quick overview of results

This storage system ensures you have complete access to all the real harvestapi data for analysis, debugging, and development purposes! 🚀
