#!/bin/bash

# Production Testing Script
# Runs comprehensive tests for AI talent acquisition platform

set -e

echo "🚀 Starting Production Testing Suite"
echo "======================================"

# Check if server is running
SERVER_URL="http://localhost:5000"
if ! curl -f -s "$SERVER_URL/health" > /dev/null; then
    echo "❌ Server not running at $SERVER_URL"
    echo "Please start the server with: npm run dev"
    exit 1
fi

echo "✅ Server is running"

# Check required environment variables
echo "🔍 Checking environment variables..."

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY not set"
    exit 1
fi

if [ -z "$APIFY_API_TOKEN" ]; then
    echo "❌ APIFY_API_TOKEN not set"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set"
    exit 1
fi

echo "✅ Environment variables configured"

# Run the test suite
echo "🧪 Running test suite..."
node test-runner.js

echo "✅ Testing complete!"