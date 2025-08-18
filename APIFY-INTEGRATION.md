# Apify LinkedIn Search Integration

This document describes the integration of the Apify `harvestapi/linkedin-profile-search` scraper to replace the localhost:8000/search endpoint and provide comprehensive LinkedIn profile data.

## Overview

The Talent Scout application now uses Apify's LinkedIn Profile Search scraper for both finding and enriching LinkedIn profiles. This single scraper provides comprehensive LinkedIn data including experience, education, skills, certifications, and more, eliminating the need for multiple scrapers.

## Features

### 1. Enhanced Search Capabilities
- **Company-based search**: Uses LinkedIn company URLs from uploaded candidate data
- **Multi-field matching**: Searches by name, title, company, and location
- **Intelligent scoring**: Ranks results based on name, title, company, and location matches
- **Fallback mechanism**: Falls back to URL generation if Apify search fails

### 2. Company URL Extraction
The system automatically extracts LinkedIn company URLs from uploaded candidate data:
- Parses company fields for LinkedIn URLs
- Removes duplicates
- Uses both current and past company URLs for broader search

### 3. Scoring Algorithm
Results are scored based on:
- **Name matching (40% weight)**: Exact name matches and partial word matches
- **Title matching (25% weight)**: Job title similarity
- **Company matching (20% weight)**: Company name similarity
- **Location matching (15% weight)**: Geographic location similarity

## Configuration

### Environment Variables
```bash
APIFY_API_TOKEN=your_apify_api_token_here
```

### Apify Actor
- **Actor ID**: `harvestapi/linkedin-profile-search`
- **Mode**: Full profile scraping
- **Max Results**: Configurable (default: 20)
- **Data Provided**: Complete LinkedIn profiles including experience, education, skills, certifications, connections, and more

## API Input Format

The Apify scraper accepts the following input parameters:

```typescript
interface ApifyLinkedInSearchInput {
  currentCompanies?: string[];      // LinkedIn company URLs
  currentJobTitles?: string[];      // Job titles to search for
  firstNames?: string[];            // First names
  lastNames?: string[];             // Last names
  locations?: string[];             // Geographic locations
  maxItems?: number;                // Maximum results to return
  pastCompanies?: string[];         // Past company LinkedIn URLs
  pastJobTitles?: string[];         // Past job titles
  profileScraperMode?: string;      // "Full" for complete profiles
  schools?: string[];               // Educational institutions
}
```

## Usage

### 1. File Upload Processing
When candidates are uploaded via CSV/Excel:
1. System extracts company LinkedIn URLs from all candidates
2. For each candidate, searches using their name, title, company, and location
3. Uses extracted company URLs to enhance search accuracy
4. Selects the best match based on scoring algorithm

### 2. Manual Search
```typescript
const linkedInService = new LinkedInService();
const profileUrl = await linkedInService.searchProfilesWithApify(
  "John Smith",
  "Software Engineer", 
  "Google",
  "San Francisco",
  20,
  candidates // Array of all uploaded candidates
);
```

### 3. Profile Enrichment
```typescript
const enrichedProfile = await linkedInService.enrichProfile(
  linkedinUrl,
  name,
  company,
  title,
  location,
  candidates // For company URL extraction
);
```

**Note**: The same `harvestapi/linkedin-profile-search` scraper is used for both searching and enriching profiles, providing consistent and comprehensive data.

## Error Handling

### 1. Missing API Token
- Falls back to URL generation
- Logs warning message
- Continues processing with basic functionality

### 2. Apify API Errors
- Handles rate limiting (429 errors)
- Handles authentication errors (403 errors)
- Handles service unavailability (500 errors)
- Falls back to URL generation on errors

### 3. No Results Found
- Logs search attempt
- Falls back to URL generation
- Continues with candidate processing

## Testing

### Test Script
Use the provided test script to verify Apify integration:

```bash
node test-apify-integration.js
```

### Manual Testing
1. Set `APIFY_API_TOKEN` environment variable
2. Upload a CSV file with candidate data
3. Check logs for Apify search results
4. Verify LinkedIn URLs are found and enriched

## Migration from Localhost Search

### Changes Made
1. **Replaced localhost:8000/search** with Apify API calls
2. **Unified scraper usage** - using only `harvestapi/linkedin-profile-search` for both search and enrichment
3. **Enhanced company URL extraction** from uploaded data
4. **Improved scoring algorithm** for better result selection
5. **Added comprehensive error handling** for API failures
6. **Maintained backward compatibility** with fallback mechanisms

### Benefits
- **More reliable**: Uses Apify's infrastructure instead of local service
- **Better results**: Access to comprehensive LinkedIn data with single scraper
- **Simplified architecture**: One scraper for both search and enrichment
- **Scalable**: Handles multiple concurrent searches
- **Robust**: Multiple fallback mechanisms ensure processing continues

## Troubleshooting

### Common Issues

1. **"APIFY_API_TOKEN not configured"**
   - Set the environment variable with your Apify API token
   - Get token from Apify console

2. **"Apify API access denied"**
   - Check your Apify subscription level
   - Verify API token is valid
   - Check usage limits

3. **"No LinkedIn profiles found"**
   - Verify candidate data has valid company information
   - Check if company LinkedIn URLs are in correct format
   - Review search parameters for accuracy

4. **Rate limiting errors**
   - System automatically handles rate limiting
   - Adds delays between requests
   - Falls back to URL generation if needed

### Debug Logging
Enable debug logging by checking console output for:
- Apify search input parameters
- Search results and scoring
- Company URL extraction
- Error messages and fallback behavior

## Future Enhancements

1. **Caching**: Cache search results to reduce API calls
2. **Batch processing**: Optimize for large candidate lists
3. **Advanced filtering**: Add more search criteria
4. **Result validation**: Verify profile authenticity
5. **Analytics**: Track search success rates and patterns
