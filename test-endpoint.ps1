# Test the resume status endpoint

$candidateId = "ef11ed6d-0348-41f5-997d-0d063a6c206e"
$url = "http://localhost:5000/api/candidates/$candidateId/resume-status"

Write-Host "Testing endpoint: $url"

try {
    $body = @{
        status = "inactive"
    } | ConvertTo-Json
    
    Write-Host "Request body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Method Patch -Body $body -ContentType "application/json"
    
    Write-Host "Success! Response:"
    $response | ConvertTo-Json -Depth 3
    
} catch {
    Write-Host "Error occurred:"
    Write-Host "Message: $($_.Exception.Message)"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody"
    }
}
