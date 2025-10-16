#!/bin/bash

# Bulk Quick Check API Test Script
# This script demonstrates how to upload a CSV file to the bulk-quick-check endpoint

echo "🚀 Testing Bulk Quick Check API with CSV Upload"
echo "================================================"
echo ""

# Configuration
API_URL="http://54.197.65.143/api/bulk-quick-check"
CSV_FILE="/home/ubuntu/apps/talent-scout/sample-candidates.csv"
COM_ID="Aimplify-123"
SAVE_TO_DB="false"  # Set to false for testing, true to save to database
PAGE=1
LIMIT=3  # Process 3 candidates at a time

echo "📋 Configuration:"
echo "  API URL: $API_URL"
echo "  CSV File: $CSV_FILE"
echo "  Company ID: $COM_ID"
echo "  Save to DB: $SAVE_TO_DB"
echo "  Page: $PAGE"
echo "  Limit: $LIMIT"
echo ""

# Check if CSV file exists
if [ ! -f "$CSV_FILE" ]; then
    echo "❌ Error: CSV file not found at $CSV_FILE"
    exit 1
fi

echo "📊 CSV File Preview (first 5 lines):"
head -5 "$CSV_FILE"
echo ""
echo "================================================"
echo ""

echo "⏳ Uploading CSV file and processing candidates..."
echo "   (This may take 25-30 seconds per NEW candidate)"
echo ""

# Make the API request
curl -X POST "$API_URL" \
  -F "file=@$CSV_FILE" \
  -F "com_id=$COM_ID" \
  -F "saveToDatabase=$SAVE_TO_DB" \
  -F "page=$PAGE" \
  -F "limit=$LIMIT" \
  -w "\n\n⏱️  Total Request Time: %{time_total}s\n" \
  -s | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('success'):
        print('✅ SUCCESS!')
        print('')
        print('📊 Results Summary:')
        pagination = data['data']['pagination']
        print(f\"  • Processed: {pagination['processedInThisBatch']} candidates\")
        print(f\"  • Current Page: {pagination['currentPage']} of {pagination['totalPages']}\")
        print(f\"  • Total Candidates in File: {pagination['totalCandidates']}\")
        print('')
        print('👥 Candidate Results:')
        for i, result in enumerate(data['data']['results'], 1):
            candidate = result['candidate']
            print(f\"  {i}. {candidate['name']} ({candidate['email']})\")
            if result.get('existingCandidate'):
                print(f\"     ⚠️  Already exists in database\")
                print(f\"     📊 Existing Score: {result['existingCandidate'].get('hireability_score', 'N/A')}\")
            else:
                linkedin = result.get('linkedinProfile')
                if linkedin:
                    print(f\"     ✅ LinkedIn: Found\")
                    print(f\"     🏢 Company: {linkedin.get('currentCompany', 'N/A')}\")
                    print(f\"     💼 Title: {linkedin.get('currentTitle', 'N/A')}\")
                    print(f\"     📊 Hireability Score: {result.get('hireabilityScore', 'N/A')}\")
                else:
                    print(f\"     ❌ LinkedIn: Not found\")
            print('')
        
        summary = data['data'].get('summary', {})
        if summary:
            print('📈 Overall Summary:')
            print(f\"  • Successful: {summary.get('successful', 0)}\")
            print(f\"  • Failed: {summary.get('failed', 0)}\")
            print(f\"  • Already Existed: {summary.get('alreadyExisted', 0)}\")
    else:
        print('❌ FAILED!')
        print(f\"Error: {data.get('error', 'Unknown error')}\")
except Exception as e:
    print(f'❌ Error parsing response: {e}')
    print('Raw response:')
    print(sys.stdin.read())
"

echo ""
echo "================================================"
echo "✅ Test Complete!"
echo ""
echo "💡 Tips:"
echo "  • To process next batch: Set page=2"
echo "  • To save to database: Set SAVE_TO_DB='true'"
echo "  • To process more candidates: Increase LIMIT value"
echo ""

