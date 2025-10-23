# PostgreSQL Database Explorer for TalentScout
param(
    [Parameter(Position=0)]
    [string]$Action = "menu"
)

$containerName = "talentscout-db"
$dbUser = "talentscout"
$dbName = "talentscout"

function Show-Menu {
    Write-Host "`n=== TalentScout Database Explorer ===" -ForegroundColor Cyan
    Write-Host "1. Show all tables" -ForegroundColor Yellow
    Write-Host "2. Count candidates" -ForegroundColor Yellow
    Write-Host "3. List all candidates" -ForegroundColor Yellow
    Write-Host "4. Show candidate details" -ForegroundColor Yellow
    Write-Host "5. Show top scored candidates" -ForegroundColor Yellow
    Write-Host "6. Show recent activities" -ForegroundColor Yellow
    Write-Host "7. Custom query" -ForegroundColor Yellow
    Write-Host "8. Connect to psql (interactive)" -ForegroundColor Yellow
    Write-Host "9. Exit" -ForegroundColor Yellow
    Write-Host ""
}

function Execute-Query {
    param([string]$Query)
    docker exec -it $containerName psql -U $dbUser -d $dbName -c $Query
}

switch ($Action) {
    "menu" {
        Show-Menu
        $choice = Read-Host "Enter your choice (1-9)"
        
        switch ($choice) {
            "1" {
                Write-Host "`nShowing all tables..." -ForegroundColor Green
                Execute-Query "\dt"
            }
            "2" {
                Write-Host "`nCounting candidates..." -ForegroundColor Green
                Execute-Query "SELECT COUNT(*) as total_candidates FROM candidates;"
            }
            "3" {
                Write-Host "`nListing all candidates..." -ForegroundColor Green
                Execute-Query "SELECT name, email, current_company, current_title, score, priority FROM candidates ORDER BY score DESC;"
            }
            "4" {
                $name = Read-Host "Enter candidate name"
                Write-Host "`nShowing details for: $name" -ForegroundColor Green
                Execute-Query "SELECT * FROM candidates WHERE name ILIKE '%$name%';"
            }
            "5" {
                Write-Host "`nTop 5 candidates by score..." -ForegroundColor Green
                Execute-Query "SELECT name, email, score, priority, hireability_score, potential_to_join FROM candidates ORDER BY score DESC LIMIT 5;"
            }
            "6" {
                Write-Host "`nRecent activities..." -ForegroundColor Green
                Execute-Query "SELECT * FROM activities ORDER BY created_at DESC LIMIT 10;"
            }
            "7" {
                $query = Read-Host "Enter your SQL query"
                Write-Host "`nExecuting custom query..." -ForegroundColor Green
                Execute-Query $query
            }
            "8" {
                Write-Host "`nConnecting to PostgreSQL interactive shell..." -ForegroundColor Green
                Write-Host "Type '\q' to exit psql" -ForegroundColor Yellow
                docker exec -it $containerName psql -U $dbUser -d $dbName
            }
            "9" {
                Write-Host "Goodbye!" -ForegroundColor Cyan
                exit
            }
            default {
                Write-Host "Invalid choice!" -ForegroundColor Red
            }
        }
    }
    "tables" {
        Execute-Query "\dt"
    }
    "count" {
        Execute-Query "SELECT COUNT(*) FROM candidates;"
    }
    "list" {
        Execute-Query "SELECT name, email, score, priority FROM candidates ORDER BY score DESC;"
    }
    default {
        Show-Menu
    }
}

