@echo off
REM Quick test script for resume parsing (Windows)
REM Usage: test-resume-quick.bat <path-to-resume.pdf>

echo ===================================================================
echo Resume Parsing Test - OpenAI
echo ===================================================================
echo.

REM Check if file argument provided
if "%~1"=="" (
  echo Error: Please provide a resume file
  echo.
  echo Usage: test-resume-quick.bat ^<path-to-resume.pdf^>
  echo Example: test-resume-quick.bat "PRAVIN PATIL.pdf"
  exit /b 1
)

REM Run the test
echo Running resume parsing test...
echo.
npx tsx test-resume-extraction.ts "%~1"

