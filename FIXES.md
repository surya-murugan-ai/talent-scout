# Recent Fixes

## 1. LinkedIn Company URL Validation ✅
**Fixed**: LinkedIn returns `999` status (anti-bot) for all company URLs, causing validation to fail.

**Solution**: 
- Now returns only ONE company URL (the most likely valid)
- Falls back to uncertain URLs when LinkedIn blocks validation
- Prioritizes work experience job titles over resume headers

**Result**:
```json
{
  "currentCompanies": ["https://www.linkedin.com/company/trionxtsoftware/"],
  "currentJobTitles": ["Software Developer"]
}
```

## 2. Resume Date Extraction ✅
**Fixed**: Work experience dates not being extracted (returned as `null`).

**Solution**: 
- Enhanced OpenAI prompt with explicit date extraction rules
- Added month abbreviation parsing (Dec=12, Feb=02, etc.)
- Clearer instructions to look for dates near company names
- Now correctly extracts: `duration: "Dec 2023 - Feb 2025"`, `startDate: "2023-12"`, `endDate: "2025-02"`

**Test Command**:
```cmd
test-resume-quick.bat "PRAVIN PATIL.pdf"
```

## 3. LinkedIn URL Caching Bug ✅
**Fixed**: System was using cached LinkedIn URL from database instead of from new resume upload, resulting in wrong person's profile data.

**Problem**: 
- Old LinkedIn URL stored in database: `https://www.linkedin.com/in/pravin-patil-685a09131`
- This was a DIFFERENT Pravin Patil (works at ProbitechSoft)
- System was re-using this cached URL even when new resume had no LinkedIn URL

**Solution**:
- Now checks NEWLY UPLOADED resume data first (not database cache)
- Only uses LinkedIn URL from the fresh resume upload
- Always scrapes fresh data when new resume is uploaded

**Important**: You need to **rebuild** the server for these changes to take effect:
```bash
npm run build
# or restart docker-compose
docker-compose up --build
```

