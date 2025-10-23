# Test bulk quick check endpoint on local Docker using curl
Write-Host "Testing bulk quick check endpoint..." -ForegroundColor Cyan
Write-Host "URL: http://localhost:5001/api/bulk-quick-check/stream" -ForegroundColor Yellow
Write-Host "File: sample-candidates.csv" -ForegroundColor Yellow
Write-Host "com_id: Aimplify-123" -ForegroundColor Yellow
Write-Host "`nSending request...`n" -ForegroundColor Green

# Use curl.exe for multipart form data
& curl.exe -X POST http://localhost:5001/api/bulk-quick-check/stream `
  -F "file=@sample-candidates.csv" `
  -F "com_id=Aimplify-123" `
  -F "saveToDatabase=false" `
  -F "page=1" `
  -F "limit=3" `
  --no-buffer

Write-Host "`n`nRequest completed!" -ForegroundColor Green

