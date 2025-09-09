# PowerShell script to test resume status functionality

$baseUrl = "http://localhost:5000"

Write-Host "🧪 Testing Resume Status Functionality..." -ForegroundColor Green

try {
    # Step 1: Get all candidates
    Write-Host "`n1️⃣ Getting all candidates..." -ForegroundColor Yellow
    $candidatesResponse = Invoke-RestMethod -Uri "$baseUrl/api/candidates" -Method Get
    Write-Host "Found $($candidatesResponse.Count) candidates"
    
    if ($candidatesResponse.Count -gt 0) {
        $candidate = $candidatesResponse[0]
        $candidateId = $candidate.id
        Write-Host "Testing with candidate: $($candidate.name) (ID: $candidateId)"
        Write-Host "Current resume status: $($candidate.resumeStatus)"
        
        # Step 2: Update status to inactive
        Write-Host "`n2️⃣ Updating status to inactive..." -ForegroundColor Yellow
        $updateBody = @{
            status = "inactive"
        } | ConvertTo-Json
        
        $updateResponse = Invoke-RestMethod -Uri "$baseUrl/api/candidates/$candidateId/resume-status" -Method Patch -Body $updateBody -ContentType "application/json"
        Write-Host "Update result: $($updateResponse.data.message)"
        
        # Step 3: Get candidates again (should show one less)
        Write-Host "`n3️⃣ Getting candidates after setting inactive..." -ForegroundColor Yellow
        $updatedCandidatesResponse = Invoke-RestMethod -Uri "$baseUrl/api/candidates" -Method Get
        Write-Host "Now found $($updatedCandidatesResponse.Count) active candidates"
        
        # Step 4: Update status back to active
        Write-Host "`n4️⃣ Updating status back to active..." -ForegroundColor Yellow
        $reactivateBody = @{
            status = "active"
        } | ConvertTo-Json
        
        $reactivateResponse = Invoke-RestMethod -Uri "$baseUrl/api/candidates/$candidateId/resume-status" -Method Patch -Body $reactivateBody -ContentType "application/json"
        Write-Host "Reactivate result: $($reactivateResponse.data.message)"
        
        # Step 5: Get candidates again (should show original count)
        Write-Host "`n5️⃣ Getting candidates after setting active..." -ForegroundColor Yellow
        $finalCandidatesResponse = Invoke-RestMethod -Uri "$baseUrl/api/candidates" -Method Get
        Write-Host "Final count: $($finalCandidatesResponse.Count) active candidates"
        
        Write-Host "`n✅ Resume status functionality test completed successfully!" -ForegroundColor Green
        
    } else {
        Write-Host "No candidates found to test with" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Error details: $($_.Exception)" -ForegroundColor Red
}
