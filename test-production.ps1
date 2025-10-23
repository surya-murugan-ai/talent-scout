# Test TalentScout Production API
$baseUrl = "http://139.59.24.123:5001"

Write-Host "`n=== Testing TalentScout Production API ===" -ForegroundColor Cyan
Write-Host "Server: $baseUrl`n" -ForegroundColor Yellow

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Green
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "   ✅ Status: Healthy" -ForegroundColor Green
    Write-Host "   Environment: $($health.environment)" -ForegroundColor White
    Write-Host "   Uptime: $($health.uptime) seconds`n" -ForegroundColor White
} catch {
    Write-Host "   ❌ Health check failed: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Bulk Quick Check with CSV
Write-Host "2. Testing Bulk Quick Check Endpoint..." -ForegroundColor Green

if (Test-Path "sample-candidates.csv") {
    Write-Host "   Using: sample-candidates.csv" -ForegroundColor White
    Write-Host "   Sending request (this may take 30-60 seconds)...`n" -ForegroundColor Yellow
    
    & curl.exe -X POST "$baseUrl/api/bulk-quick-check/stream" `
      -F "file=@sample-candidates.csv" `
      -F "com_id=Production-Test-123" `
      -F "saveToDatabase=false" `
      -F "page=1" `
      -F "limit=2" `
      --no-buffer
    
    Write-Host "`n   ✅ Bulk check completed!" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  sample-candidates.csv not found" -ForegroundColor Yellow
}

Write-Host "`n=== Testing Complete! ===" -ForegroundColor Cyan

