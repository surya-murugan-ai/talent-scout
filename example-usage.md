# Enhanced LinkedIn Search - Usage Examples

## Quick Start

### 1. Start the Application

```bash
# Start the Talent Scout application
npm run dev

# Ensure the LinkedIn search API is running on port 8000
# (This should be your external search service)
```

### 2. Test with Sample Candidates

The system is designed to work with your `test_candidates.csv` file. Here's how it processes each candidate:

## Example 1: Surya Murugan

**Input Data:**
```csv
Name,Email,Phone,LinkedIn,Position,Company,Experience,Skills,Location
Surya Murugan,surya.murugan.2026@gmail.com,9967137495,https://www.linkedin.com/in/surya-murugan-ragaiyan/,full stack developer,Aimplify,1 year,"JavaScript, React, Node.js, Python, Django, SQL, Postgres",Banglore
```

**Processing Flow:**

1. **Search Request:**
```bash
curl -X POST "http://localhost:3000/api/test-linkedin-search" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Surya Murugan",
    "title": "full stack developer",
    "company": "Aimplify",
    "location": "Banglore",
    "maxResults": 10
  }'
```

2. **Search API Call:**
```bash
curl -X POST "http://localhost:8000/search" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Surya Murugan",
    "title": "Full Stack developer",
    "company": "Aimplify",
    "max_results": 10
  }'
```

3. **Expected Response:**
```json
{
  "query": {
    "name": "Surya Murugan",
    "title": "Full Stack developer",
    "company": "Aimplify",
    "location": null,
    "max_results": 10
  },
  "results": [
    {
      "url": "https://in.linkedin.com/in/surya-murugan-ragaiyan",
      "title": "Surya Murugan - Flask || Django || DRF || SQL",
      "snippet": "Mumbai, Maharashtra, India · Full Stack Developer · Aimplify Aimplify Graphic. Full Stack Developer. Aimplify. May 2025 - Present 3 months. Bengaluru, Karnataka, India. Sapat International Graphic. Software Developer.",
      "score": 8.0
    }
  ],
  "total_results": 1,
  "search_time": 68.18,
  "timestamp": "2025-08-15T23:24:57.647238"
}
```

4. **Enhanced Scoring:**
```
Name match score: 1.00 (exact match)
Title match score: 0.85 (partial match - "Full Stack" vs "full stack developer")
Company match score: 1.00 (exact match - "Aimplify")
Location match score: 0.60 (partial match - "Banglore" vs "Bengaluru")
Snippet relevance score: 0.50 (name and company mentioned)
Enhanced score: 8.50
```

5. **Selected Result:**
```json
{
  "success": true,
  "selectedUrl": "https://in.linkedin.com/in/surya-murugan-ragaiyan",
  "message": "LinkedIn search completed successfully"
}
```

## Example 2: Pravin Patil

**Input Data:**
```csv
Name,Email,Phone,LinkedIn,Position,Company,Experience,Skills,Location
Pravin Patil,pravin.patil@email.com,9876543210,https://www.linkedin.com/in/pravin-patil-888857241/,Freelance Developer,Self-employed,3 years,"Python, Django, React, AWS, Docker, Git",Mumbai
```

**Processing Flow:**

1. **Search Request:**
```bash
curl -X POST "http://localhost:3000/api/test-linkedin-search" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pravin Patil",
    "title": "Freelance Developer",
    "company": "Self-employed",
    "location": "Mumbai",
    "maxResults": 10
  }'
```

2. **Expected Scoring:**
```
Name match score: 1.00 (exact match)
Title match score: 0.90 (partial match - "Freelance Developer")
Company match score: 0.70 (partial match - "Self-employed" variations)
Location match score: 1.00 (exact match - "Mumbai")
Enhanced score: 7.60
```

## Example 3: Mahesh Konchada

**Input Data:**
```csv
Name,Email,Phone,LinkedIn,Position,Company,Experience,Skills,Location
Mahesh Konchada,mahesh@aimplify.tech,8765432109,https://www.linkedin.com/in/mahesh-konchada-996985150/,Product Manager - AI Solutions,Aimplify,2 years,"Product Management, AI/ML, Python, SQL, Agile, JIRA",Bengaluru
```

**Processing Flow:**

1. **Search Request:**
```bash
curl -X POST "http://localhost:3000/api/test-linkedin-search" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mahesh Konchada",
    "title": "Product Manager - AI Solutions",
    "company": "Aimplify",
    "location": "Bengaluru",
    "maxResults": 10
  }'
```

2. **Expected Scoring:**
```
Name match score: 1.00 (exact match)
Title match score: 0.95 (high match - "Product Manager")
Company match score: 1.00 (exact match - "Aimplify")
Location match score: 1.00 (exact match - "Bengaluru")
Enhanced score: 8.85
```

## File Upload Example

### Upload CSV File

```bash
curl -X POST "http://localhost:3000/api/upload" \
  -F "file=@test_candidates.csv"
```

### Processing Job Response

```json
{
  "message": "File uploaded successfully",
  "jobId": "job-12345",
  "filename": "test_candidates.csv",
  "size": 2048
}
```

### Monitor Processing

```bash
curl "http://localhost:3000/api/jobs/job-12345"
```

**Response:**
```json
{
  "id": "job-12345",
  "status": "processing",
  "progress": 75,
  "totalRecords": 6,
  "processedRecords": 4,
  "fileName": "test_candidates.csv"
}
```

## Complete Processing Flow

### 1. File Upload
- CSV file uploaded via `/api/upload`
- File parsed and normalized
- Processing job created

### 2. Candidate Processing (for each candidate)
```typescript
// Enhanced LinkedIn search
const linkedInUrl = await linkedInService.searchProfilesWithScoring(
  candidate.name,
  candidate.title,
  candidate.company,
  candidate.location
);

// Profile enrichment with Apify
const linkedInProfile = await linkedInService.enrichProfile(
  linkedInUrl,
  candidate.name,
  candidate.company,
  candidate.title,
  candidate.location
);

// AI analysis and scoring
const analysis = await analyzeCandidate({
  ...candidate,
  linkedinProfile: linkedInProfile
}, "", weights);

// Database storage
await storage.createCandidate({
  name: candidate.name,
  email: candidate.email,
  title: linkedInProfile.title || candidate.title,
  company: linkedInProfile.company || candidate.company,
  linkedinUrl: linkedInUrl,
  skills: linkedInProfile.skills.length > 0 ? linkedInProfile.skills : candidate.skills,
  score: analysis.overallScore,
  priority: analysis.priority,
  openToWork: linkedInProfile.openToWork,
  lastActive: linkedInProfile.lastActive,
  notes: analysis.insights.join('; '),
  // ATS fields
  atsId: candidate.atsId,
  selectionStatus: candidate.selectionStatus,
  selectionDate: candidate.selectionDate ? new Date(candidate.selectionDate) : null,
  joiningOutcome: candidate.joiningOutcome,
  atsNotes: candidate.atsNotes
});
```

### 3. Results

After processing, you'll have enriched candidates with:
- **Accurate LinkedIn URLs** (selected from multiple results)
- **Enhanced profile data** (scraped from LinkedIn)
- **AI-generated scores** (based on multiple criteria)
- **ATS integration data** (from original CSV)
- **Comprehensive notes** (combining AI insights and ATS data)

## Testing the System

### Run the Test Script

```bash
node test-enhanced-linkedin-search.js
```

This will test:
- Direct search API functionality
- Enhanced search through the application
- Profile enrichment with selected URLs
- Error handling scenarios

### Expected Output

```
🚀 Starting Enhanced LinkedIn Search Tests

🔍 Testing Direct Search API Endpoint

Search payload: {
  "name": "Surya Murugan",
  "title": "Full Stack developer",
  "company": "Aimplify",
  "max_results": 10
}

📊 Search API Response:
   Total results: 1
   Search time: 68.18ms
   Timestamp: 2025-08-15T23:24:57.647238

🎯 Results:
   1. https://in.linkedin.com/in/surya-murugan-ragaiyan
      Title: Surya Murugan - Flask || Django || DRF || SQL
      Score: 8.0
      Snippet: Mumbai, Maharashtra, India · Full Stack Developer · Aimplify...

🔍 Testing Enhanced LinkedIn Search with Scoring

📋 Testing candidate: Surya Murugan
   Title: full stack developer
   Company: Aimplify
   Location: Banglore
   Current LinkedIn: https://www.linkedin.com/in/surya-murugan-ragaiyan/
   ✅ Search successful
   🎯 Selected URL: https://in.linkedin.com/in/surya-murugan-ragaiyan
   📊 Enrichment successful
   🏢 Enriched company: Aimplify
   💼 Enriched title: Full Stack Developer
   🎯 Open to work: false
   📈 Score: 85.5

🎉 Enhanced LinkedIn Search Test Completed!
```

## Troubleshooting

### Common Issues

1. **Search API Not Available**
   ```
   ❌ Error: fetch failed: connect ECONNREFUSED 127.0.0.1:8000
   ```
   **Solution:** Ensure the LinkedIn search API is running on port 8000

2. **No Results Found**
   ```
   ❌ Search failed: No suitable match found among search results
   ```
   **Solution:** Check candidate name spelling and try different search parameters

3. **Low Match Scores**
   ```
   No result meets minimum score threshold of 6.0
   ```
   **Solution:** Adjust scoring weights or minimum threshold in the configuration

### Debug Mode

Enable detailed logging by setting environment variables:

```bash
DEBUG=linkedin:search,linkedin:scoring npm run dev
```

This will show detailed scoring calculations and selection criteria.

