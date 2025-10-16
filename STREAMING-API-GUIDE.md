# 🌊 Real-Time Streaming Bulk Quick Check API

## Overview

The **Streaming Bulk Quick Check API** provides real-time updates as each candidate is processed, using **Server-Sent Events (SSE)**. Unlike the standard bulk endpoint that waits for all candidates to finish, this endpoint streams results immediately as they complete.

---

## 🎯 Key Features

✅ **Real-Time Updates** - Get results as each candidate finishes processing  
✅ **Failure Resilient** - If one candidate fails, processing continues  
✅ **Progress Tracking** - Know exactly which candidate is being processed  
✅ **Same Functionality** - LinkedIn search, AI scoring, database save  
✅ **No Waiting** - See results every ~25-30 seconds instead of waiting 4-5 minutes  

---

## 📡 Endpoint

```
POST /api/bulk-quick-check/stream
```

**Content-Type:** `multipart/form-data`  
**Response-Type:** `text/event-stream` (Server-Sent Events)

---

## 📥 Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file` | File | ✅ Yes | - | CSV or XLSX file with candidates |
| `com_id` | String | ✅ Yes | - | Company ID for multi-tenancy |
| `saveToDatabase` | Boolean | ❌ No | `true` | Save candidates to database |
| `page` | Number | ❌ No | `1` | Page number for pagination |
| `limit` | Number | ❌ No | `10` | Candidates per page |

---

## 📤 Response Format (SSE Events)

The API sends multiple events as processing progresses:

### 1️⃣ Start Event
Sent immediately when processing begins.

```json
{
  "type": "start",
  "totalCandidates": 5,
  "page": 1,
  "totalPages": 1
}
```

### 2️⃣ Candidate Events
Sent for each candidate as it finishes processing.

**Successful Candidate:**
```json
{
  "type": "candidate",
  "index": 1,
  "total": 5,
  "success": true,
  "candidateId": 123,
  "candidateInfo": {
    "name": "John Doe",
    "email": "john@example.com",
    "providedCompany": "Google",
    "providedTitle": "Software Engineer",
    "location": "San Francisco"
  },
  "linkedinProfile": {
    "profileUrl": "https://linkedin.com/in/johndoe",
    "name": "John Doe",
    "currentCompany": "Google",
    "currentTitle": "Senior Software Engineer",
    "headline": "Software Engineer at Google",
    "location": "San Francisco Bay Area",
    "summary": "...",
    "connections": 500,
    "skills": ["JavaScript", "Python", "React"],
    "education": [...],
    "certifications": [...],
    "openToWork": true,
    "lastActive": "1 week ago",
    "jobHistory": [...],
    "recentActivity": [...],
    "profilePicture": "...",
    "industry": "Technology",
    "languages": ["English", "Spanish"]
  },
  "scoring": {
    "skillMatch": 85,
    "openToWork": 90,
    "jobStability": 75,
    "engagement": 80,
    "companyConsistency": 70,
    "overallScore": 80,
    "priority": "High"
  },
  "hireability": {
    "score": 85,
    "potentialToJoin": "High",
    "factors": {
      "openToWork": true,
      "companyMatch": true,
      "recentActivity": true,
      "skillsAvailable": true
    }
  },
  "insights": ["Strong technical background", "Open to opportunities"],
  "companyDifference": "Same",
  "savedToDatabase": true,
  "isExistingCandidate": false,
  "processingTime": 28500
}
```

**Failed Candidate:**
```json
{
  "type": "candidate",
  "index": 3,
  "total": 5,
  "success": false,
  "candidateInfo": {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "providedCompany": "Microsoft",
    "providedTitle": "Developer"
  },
  "error": "LinkedIn profile not found",
  "errorType": "NotFoundError",
  "processingTime": 15000
}
```

**Existing Candidate:**
```json
{
  "type": "candidate",
  "index": 2,
  "total": 5,
  "success": true,
  "candidateInfo": {
    "name": "Bob Johnson",
    "email": "bob@example.com",
    "providedCompany": "Amazon",
    "providedTitle": "Engineer"
  },
  "existingCandidate": {
    "id": 456,
    "name": "Bob Johnson",
    "email": "bob@example.com",
    "company": "Amazon",
    "title": "Software Engineer",
    "score": 75,
    "priority": "Medium",
    "hireabilityScore": 72,
    "potentialToJoin": "High",
    "linkedinUrl": "https://linkedin.com/in/bobjohnson",
    "openToWork": true
  },
  "isExistingCandidate": true,
  "processingTime": 150
}
```

### 3️⃣ Complete Event
Sent when all candidates have been processed.

```json
{
  "type": "complete",
  "summary": {
    "totalProcessed": 5,
    "successful": 4,
    "failed": 1,
    "existing": 1,
    "new": 3
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalCandidates": 5
  }
}
```

### 4️⃣ Error Event
Sent if a critical error occurs (rare).

```json
{
  "type": "error",
  "error": "Database connection failed"
}
```

---

## 🚀 Usage Examples

### cURL Example

```bash
curl -X POST http://54.197.65.143/api/bulk-quick-check/stream \
  -F "file=@candidates.csv" \
  -F "com_id=Aimplify-123" \
  -F "saveToDatabase=true" \
  -F "page=1" \
  -F "limit=5" \
  -N
```

**Note:** The `-N` flag disables buffering to see events in real-time.

### JavaScript/Node.js Example

```javascript
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

const form = new FormData();
form.append('file', fs.createReadStream('candidates.csv'));
form.append('com_id', 'Aimplify-123');
form.append('saveToDatabase', 'true');
form.append('page', '1');
form.append('limit', '5');

fetch('http://54.197.65.143/api/bulk-quick-check/stream', {
  method: 'POST',
  body: form
})
.then(response => {
  const reader = response.body;
  
  reader.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    
    lines.forEach(line => {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        
        if (data.type === 'start') {
          console.log(`🚀 Processing ${data.totalCandidates} candidates...`);
        } else if (data.type === 'candidate') {
          if (data.success) {
            console.log(`✅ [${data.index}/${data.total}] ${data.candidateInfo.name} - Score: ${data.hireability?.score}`);
          } else {
            console.log(`❌ [${data.index}/${data.total}] ${data.candidateInfo.name} - Failed: ${data.error}`);
          }
        } else if (data.type === 'complete') {
          console.log(`🎉 Complete! ${data.summary.successful} successful, ${data.summary.failed} failed`);
        }
      }
    });
  });
});
```

### Python Example

```python
import requests
import json

url = 'http://54.197.65.143/api/bulk-quick-check/stream'
files = {'file': open('candidates.csv', 'rb')}
data = {
    'com_id': 'Aimplify-123',
    'saveToDatabase': 'true',
    'page': 1,
    'limit': 5
}

response = requests.post(url, files=files, data=data, stream=True)

for line in response.iter_lines():
    if line:
        line_str = line.decode('utf-8')
        if line_str.startswith('data: '):
            event_data = json.loads(line_str[6:])
            
            if event_data['type'] == 'start':
                print(f"🚀 Processing {event_data['totalCandidates']} candidates...")
            elif event_data['type'] == 'candidate':
                if event_data['success']:
                    name = event_data['candidateInfo']['name']
                    score = event_data.get('hireability', {}).get('score', 'N/A')
                    print(f"✅ [{event_data['index']}/{event_data['total']}] {name} - Score: {score}")
                else:
                    name = event_data['candidateInfo']['name']
                    error = event_data['error']
                    print(f"❌ [{event_data['index']}/{event_data['total']}] {name} - Failed: {error}")
            elif event_data['type'] == 'complete':
                summary = event_data['summary']
                print(f"🎉 Complete! {summary['successful']} successful, {summary['failed']} failed")
```

### Browser/Frontend Example

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('com_id', 'Aimplify-123');
formData.append('saveToDatabase', 'true');
formData.append('page', '1');
formData.append('limit', '5');

fetch('http://54.197.65.143/api/bulk-quick-check/stream', {
  method: 'POST',
  body: formData
})
.then(response => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  function readStream() {
    reader.read().then(({ done, value }) => {
      if (done) {
        console.log('Stream complete');
        return;
      }
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      lines.forEach(line => {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6));
          
          if (data.type === 'candidate') {
            // Update UI with candidate result
            updateCandidateUI(data);
          } else if (data.type === 'complete') {
            // Show completion summary
            showSummary(data.summary);
          }
        }
      });
      
      readStream();
    });
  }
  
  readStream();
});
```

---

## ⏱️ Processing Time

| Scenario | Time per Candidate | Total Time (5 candidates) |
|----------|-------------------|---------------------------|
| New candidate | ~25-30 seconds | Results stream every 25-30s |
| Existing candidate | ~150ms | Result streams immediately |
| Failed candidate | ~5-15 seconds | Result streams with error |

**Streaming Advantage:**
- **Non-streaming:** Wait 2-3 minutes → Get all 5 results at once
- **Streaming:** See result #1 after 25s, #2 after 50s, #3 after 75s, etc.

---

## 🔄 Failure Handling

### ✅ Resilient Processing

If candidate #3 fails, the API:
1. ✅ Streams the failure event immediately
2. ✅ Continues processing candidate #4
3. ✅ Continues processing candidate #5
4. ✅ Sends complete event with summary

**Example Flow:**
```
[1/5] ✅ John Doe - Success (28s)
[2/5] ✅ Jane Smith - Existing (0.15s)
[3/5] ❌ Bob Johnson - Failed: LinkedIn not found (15s)
[4/5] ✅ Alice Williams - Success (27s)
[5/5] ✅ Charlie Brown - Success (29s)

🎉 Complete! 4 successful, 1 failed
```

---

## 📊 Comparison: Streaming vs Non-Streaming

| Feature | Non-Streaming | Streaming |
|---------|--------------|-----------|
| **Endpoint** | `/api/bulk-quick-check` | `/api/bulk-quick-check/stream` |
| **Response Type** | JSON (single response) | SSE (multiple events) |
| **When Results Arrive** | All at once at the end | One by one as they complete |
| **Wait Time (5 candidates)** | 2-3 minutes total | See first result in 25s |
| **Progress Visibility** | None until complete | Real-time progress |
| **Failure Handling** | Same (continues processing) | Same (continues processing) |
| **Use Case** | Batch processing, background jobs | Interactive UI, real-time feedback |

---

## 🧪 Testing

### Quick Test Script

We've provided a test script that demonstrates the streaming functionality:

```bash
cd /home/ubuntu/apps/talent-scout
./test-streaming.sh
```

This script:
- Uploads the sample CSV file
- Processes 3 candidates
- Shows real-time updates as each completes
- Demonstrates failure handling
- Displays final summary

---

## 🎯 Use Cases

### ✅ Best For Streaming:
- **Interactive web applications** - Show progress to users
- **Real-time dashboards** - Update UI as candidates process
- **Progress tracking** - Know exactly where processing is
- **Quick feedback** - See results without waiting for all
- **User engagement** - Keep users informed during long operations

### ✅ Best For Non-Streaming:
- **Background jobs** - Process large batches overnight
- **API integrations** - Systems that expect single JSON response
- **Simple scripts** - No need for event stream parsing
- **Batch imports** - Process hundreds of candidates at once

---

## 🚨 Common Issues

### Issue: Events not appearing in real-time

**Solution:** Make sure you're using the `-N` flag with cURL or setting `stream=True` in Python requests.

```bash
# ✅ Correct
curl -N http://...

# ❌ Wrong (buffered)
curl http://...
```

### Issue: Connection timeout

**Solution:** Increase timeout settings. Processing 10 candidates takes ~4-5 minutes.

```javascript
// Node.js
fetch(url, { timeout: 600000 }) // 10 minutes

// Python
requests.post(url, timeout=600) // 10 minutes
```

### Issue: Nginx buffering responses

**Solution:** The API sets `X-Accel-Buffering: no` header. If using Nginx, ensure it respects this:

```nginx
location /api/ {
    proxy_buffering off;
    proxy_pass http://localhost:5000;
}
```

### Issue: Parsing SSE events

**Solution:** SSE format is:
```
data: {"type":"candidate",...}\n\n
```

Always:
1. Check if line starts with `data: `
2. Remove the `data: ` prefix
3. Parse the remaining JSON

---

## 📝 CSV File Format

Same as the non-streaming endpoint:

```csv
name,email,company,title,location
John Doe,john@example.com,Google,Software Engineer,San Francisco
Jane Smith,jane@example.com,Microsoft,Senior Developer,Seattle
```

**Required columns:** name, email, company, title  
**Optional columns:** location

---

## 🔐 Security

- Same authentication as other endpoints
- File size limit: 50MB
- Supported formats: CSV, XLSX only
- Company isolation via `com_id`

---

## 📚 Related Documentation

- **BULK-QUICK-CHECK-API.md** - Non-streaming bulk endpoint
- **QUICK-CHECK-API.md** - Single candidate endpoint
- **BULK-UPLOAD-GUIDE.md** - File upload guide
- **FILE-UPLOAD-SUMMARY.md** - Quick reference

---

## 🎉 Quick Start

1. **Prepare your CSV file** with candidate data
2. **Choose streaming for real-time updates:**
   ```bash
   curl -X POST http://54.197.65.143/api/bulk-quick-check/stream \
     -F "file=@candidates.csv" \
     -F "com_id=your-company-id" \
     -F "limit=5" \
     -N
   ```
3. **Watch results stream in real-time!**

---

## 💡 Pro Tips

1. **Start with `limit=3`** for testing to see streaming in action quickly
2. **Use streaming for interactive UIs** where users need to see progress
3. **Use non-streaming for batch jobs** where you process results all at once
4. **Failures don't stop the flow** - you'll always get results for all candidates
5. **Existing candidates return instantly** (~150ms) vs new candidates (~25-30s)

---

**Happy Streaming! 🌊**

