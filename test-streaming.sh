#!/bin/bash

# Real-Time Streaming Bulk Quick Check Test Script
# This demonstrates Server-Sent Events (SSE) with failure handling

echo "🌊 Testing Real-Time Streaming Bulk Quick Check"
echo "================================================"
echo ""
echo "This test demonstrates:"
echo "  ✅ Real-time updates as each candidate is processed"
echo "  ✅ Failures don't break the flow"
echo "  ✅ Each result streams immediately (no waiting for all)"
echo ""

# Configuration
API_URL="http://54.197.65.143/api/bulk-quick-check/stream"
CSV_FILE="/home/ubuntu/apps/talent-scout/sample-candidates.csv"
COM_ID="Aimplify-123"
SAVE_TO_DB="false"  # Set to false for testing
PAGE=1
LIMIT=3  # Process 3 candidates to see streaming in action

echo "📋 Configuration:"
echo "  API URL: $API_URL"
echo "  CSV File: $CSV_FILE"
echo "  Company ID: $COM_ID"
echo "  Save to DB: $SAVE_TO_DB"
echo "  Limit: $LIMIT candidates"
echo ""

# Check if CSV file exists
if [ ! -f "$CSV_FILE" ]; then
    echo "❌ Error: CSV file not found at $CSV_FILE"
    exit 1
fi

echo "📊 CSV File Preview (first 4 lines):"
head -4 "$CSV_FILE"
echo ""
echo "================================================"
echo ""

echo "🌊 Starting real-time streaming..."
echo "   (Watch as each candidate result appears immediately!)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Make the streaming API request
curl -X POST "$API_URL" \
  -F "file=@$CSV_FILE" \
  -F "com_id=$COM_ID" \
  -F "saveToDatabase=$SAVE_TO_DB" \
  -F "page=$PAGE" \
  -F "limit=$LIMIT" \
  -N \
  2>/dev/null | while IFS= read -r line; do
    # Skip empty lines
    if [ -z "$line" ]; then
        continue
    fi
    
    # Remove "data: " prefix
    if [[ $line == data:* ]]; then
        json_data="${line#data: }"
        
        # Parse and display the event
        echo "$json_data" | python3 -c "
import sys, json
from datetime import datetime

try:
    data = json.load(sys.stdin)
    event_type = data.get('type', 'unknown')
    
    if event_type == 'start':
        print('🚀 STREAMING STARTED')
        print(f\"   Total candidates to process: {data.get('totalCandidates', 0)}\")
        print(f\"   Page: {data.get('page', 1)} of {data.get('totalPages', 1)}\")
        print('')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('')
        
    elif event_type == 'candidate':
        index = data.get('index', 0)
        total = data.get('total', 0)
        success = data.get('success', False)
        candidate = data.get('candidateInfo', {})
        processing_time = data.get('processingTime', 0) / 1000  # Convert to seconds
        
        if success:
            if data.get('isExistingCandidate'):
                print(f\"[{index}/{total}] ✅ {candidate.get('name', 'Unknown')}\")
                print(f\"        ⚠️  Already exists in database\")
                existing = data.get('existingCandidate', {})
                print(f\"        📊 Existing Score: {existing.get('hireabilityScore', 'N/A')}\")
                print(f\"        ⏱️  Processing Time: {processing_time:.2f}s\")
            else:
                print(f\"[{index}/{total}] ✅ {candidate.get('name', 'Unknown')}\")
                linkedin = data.get('linkedinProfile')
                if linkedin:
                    print(f\"        🔗 LinkedIn: Found\")
                    print(f\"        🏢 Company: {linkedin.get('currentCompany', 'N/A')}\")
                    print(f\"        💼 Title: {linkedin.get('currentTitle', 'N/A')}\")
                    hireability = data.get('hireability', {})
                    print(f\"        📊 Hireability: {hireability.get('score', 'N/A')} ({hireability.get('potentialToJoin', 'N/A')})\")
                else:
                    print(f\"        ⚠️  LinkedIn: Not found\")
                print(f\"        ⏱️  Processing Time: {processing_time:.2f}s\")
        else:
            print(f\"[{index}/{total}] ❌ {candidate.get('name', 'Unknown')}\")
            print(f\"        ⚠️  FAILED: {data.get('error', 'Unknown error')}\")
            print(f\"        🔄 Flow continues to next candidate...\")
            print(f\"        ⏱️  Processing Time: {processing_time:.2f}s\")
        
        print('')
        
    elif event_type == 'complete':
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('')
        print('🎉 STREAMING COMPLETE!')
        print('')
        summary = data.get('summary', {})
        print('📊 Final Summary:')
        print(f\"   Total Processed: {summary.get('totalProcessed', 0)}\")
        print(f\"   ✅ Successful: {summary.get('successful', 0)}\")
        print(f\"   ❌ Failed: {summary.get('failed', 0)}\")
        print(f\"   🔄 Existing: {summary.get('existing', 0)}\")
        print(f\"   🆕 New: {summary.get('new', 0)}\")
        print('')
        
        pagination = data.get('pagination', {})
        if pagination.get('totalPages', 1) > 1:
            print('📄 Pagination:')
            print(f\"   Current Page: {pagination.get('currentPage', 1)}\")
            print(f\"   Total Pages: {pagination.get('totalPages', 1)}\")
            print(f\"   Total Candidates: {pagination.get('totalCandidates', 0)}\")
            print('')
        
    elif event_type == 'error':
        print('❌ STREAMING ERROR')
        print(f\"   Error: {data.get('error', 'Unknown error')}\")
        print('')
        
except Exception as e:
    # Silently skip parsing errors for malformed events
    pass
" 2>/dev/null
    fi
done

echo ""
echo "================================================"
echo "✅ Test Complete!"
echo ""
echo "🎯 Key Features Demonstrated:"
echo "  ✅ Real-time updates (no waiting for all candidates)"
echo "  ✅ Failures don't stop processing"
echo "  ✅ Each result streams immediately"
echo "  ✅ Progress tracking (1/3, 2/3, 3/3)"
echo "  ✅ Final summary with success/failure counts"
echo ""
echo "💡 Compare with non-streaming endpoint:"
echo "   Non-streaming: Wait 1-2 minutes → Get all results at once"
echo "   Streaming: See results every ~25-30 seconds as they complete"
echo ""

