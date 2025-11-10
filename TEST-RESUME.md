# Test Resume Parsing

## Quick Start

```cmd
# Windows
test-resume-quick.bat "PRAVIN PATIL.pdf"

# Or manually
npx tsx test-resume-extraction.ts "PRAVIN PATIL.pdf"
```

## What It Does
1. Extracts text from your PDF/DOCX
2. Shows if dates are in the extracted text
3. Tests OpenAI extraction
4. Tells you what's wrong

## Output Files
- `extracted-resume-text.txt` - Check if dates are here!
- `resume-parsing-comparison.json` - Full results

