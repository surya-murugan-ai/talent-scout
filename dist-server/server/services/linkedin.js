import { ApifyClient } from 'apify-client';
import * as fs from 'fs';
import * as path from 'path';
import { ResumeDataService } from './resumeDataService.js';
export class LinkedInService {
    apifyClient;
    constructor() {
        const apifyToken = process.env.APIFY_API_TOKEN;
        if (!apifyToken) {
            console.warn('APIFY_API_TOKEN not found. LinkedIn enrichment will use fallback mode.');
        }
        this.apifyClient = new ApifyClient({
            token: apifyToken,
        });
    }
    /**
     * Use dev_fusion/Linkedin-Profile-Scraper actor to get profile details from LinkedIn URL
     */
    async getProfileWithDevFusion(linkedinUrl) {
        try {
            console.log(`Using dev_fusion/Linkedin-Profile-Scraper for URL: ${linkedinUrl}`);
            const input = {
                profileUrls: [linkedinUrl]
            };
            // Run the dev_fusion actor
            const run = await this.apifyClient.actor("dev_fusion/Linkedin-Profile-Scraper").call(input);
            // Fetch results
            const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
            if (!items || items.length === 0) {
                console.log('No profile data found with dev_fusion actor');
                return null;
            }
            console.log(`Found profile data with dev_fusion actor:`, items[0]);
            return items[0];
        }
        catch (error) {
            console.error('Error using dev_fusion actor:', error);
            return null;
        }
    }
    /**
     * Save raw dev_fusion results to a JSON file
     */
    saveDevFusionResults(data, linkedinUrl, timestamp = new Date().toISOString()) {
        try {
            // Create results directory if it doesn't exist
            const resultsDir = path.join(process.cwd(), 'devfusion-results');
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
            }
            // Create filename with timestamp and profile identifier
            const profileId = linkedinUrl.split('/in/')[1]?.split('?')[0] || 'unknown';
            const filename = `devfusion_${profileId}_${timestamp.replace(/[:.]/g, '-')}.json`;
            const filepath = path.join(resultsDir, filename);
            // Save the raw data
            const resultData = {
                timestamp: timestamp,
                linkedinUrl: linkedinUrl,
                rawData: data,
                metadata: {
                    source: 'dev_fusion/Linkedin-Profile-Scraper',
                    savedAt: new Date().toISOString()
                }
            };
            fs.writeFileSync(filepath, JSON.stringify(resultData, null, 2));
            console.log(`✅ DevFusion results saved to: ${filepath}`);
        }
        catch (error) {
            console.error('❌ Failed to save DevFusion results:', error);
        }
    }
    /**
     * Save raw harvestapi results to a JSON file
     */
    saveHarvestApiResults(data, searchQuery, timestamp = new Date().toISOString()) {
        try {
            // Create results directory if it doesn't exist
            const resultsDir = path.join(process.cwd(), 'harvestapi-results');
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
            }
            // Create filename with timestamp and search query
            const sanitizedQuery = searchQuery.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
            const filename = `harvestapi_${sanitizedQuery}_${timestamp.replace(/[:.]/g, '-')}.json`;
            const filepath = path.join(resultsDir, filename);
            // Save the raw data
            const resultData = {
                timestamp: timestamp,
                searchQuery: searchQuery,
                rawData: data,
                metadata: {
                    totalResults: Array.isArray(data) ? data.length : 1,
                    source: 'harvestapi/linkedin-profile-search',
                    savedAt: new Date().toISOString()
                }
            };
            fs.writeFileSync(filepath, JSON.stringify(resultData, null, 2));
            console.log(`✅ HarvestAPI results saved to: ${filepath}`);
            // Also save a summary file
            this.saveResultsSummary(resultData, filepath);
        }
        catch (error) {
            console.error('❌ Failed to save HarvestAPI results:', error);
        }
    }
    /**
     * Save a summary of the results
     */
    saveResultsSummary(resultData, originalFilepath) {
        try {
            const summaryDir = path.join(process.cwd(), 'harvestapi-results', 'summaries');
            if (!fs.existsSync(summaryDir)) {
                fs.mkdirSync(summaryDir, { recursive: true });
            }
            const filename = path.basename(originalFilepath, '.json') + '_summary.json';
            const summaryPath = path.join(summaryDir, filename);
            // Create a summary with key information
            const summary = {
                timestamp: resultData.timestamp,
                searchQuery: resultData.searchQuery,
                totalResults: resultData.metadata.totalResults,
                profiles: Array.isArray(resultData.rawData) ? resultData.rawData.map((profile, index) => ({
                    index: index + 1,
                    name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
                    headline: profile.headline || 'N/A',
                    location: profile['location/linkedinText'] || profile.location?.linkedinText || 'N/A',
                    currentCompany: profile['currentPosition/0/companyName'] || profile.currentPosition?.[0]?.companyName || 'N/A',
                    currentPosition: profile['currentPosition/0/position'] || profile.currentPosition?.[0]?.position || 'N/A',
                    linkedinUrl: profile.linkedinUrl || 'N/A',
                    connectionsCount: profile.connectionsCount || 'N/A',
                    skillsCount: profile.skills ? (Array.isArray(profile.skills) ? profile.skills.length : 0) : 0,
                    experienceCount: profile.experience ? (Array.isArray(profile.experience) ? profile.experience.length : 0) : 0,
                    educationCount: profile.education ? (Array.isArray(profile.education) ? profile.education.length : 0) : 0
                })) : [{
                        name: `${resultData.rawData.firstName || ''} ${resultData.rawData.lastName || ''}`.trim(),
                        headline: resultData.rawData.headline || 'N/A',
                        location: resultData.rawData['location/linkedinText'] || resultData.rawData.location?.linkedinText || 'N/A',
                        currentCompany: resultData.rawData['currentPosition/0/companyName'] || resultData.rawData.currentPosition?.[0]?.companyName || 'N/A',
                        currentPosition: resultData.rawData['currentPosition/0/position'] || resultData.rawData.currentPosition?.[0]?.position || 'N/A',
                        linkedinUrl: resultData.rawData.linkedinUrl || 'N/A',
                        connectionsCount: resultData.rawData.connectionsCount || 'N/A',
                        skillsCount: resultData.rawData.skills ? (Array.isArray(resultData.rawData.skills) ? resultData.rawData.skills.length : 0) : 0,
                        experienceCount: resultData.rawData.experience ? (Array.isArray(resultData.rawData.experience) ? resultData.rawData.experience.length : 0) : 0,
                        educationCount: resultData.rawData.education ? (Array.isArray(resultData.rawData.education) ? resultData.rawData.education.length : 0) : 0
                    }],
                originalFile: path.basename(originalFilepath)
            };
            fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
            console.log(`📋 Results summary saved to: ${summaryPath}`);
        }
        catch (error) {
            console.error('❌ Failed to save results summary:', error);
        }
    }
    /**
     * Extract LinkedIn profile URL from various formats
     */
    normalizeLinkedInUrl(url) {
        if (!url)
            return null;
        // Handle various LinkedIn URL formats
        const patterns = [
            /linkedin\.com\/in\/([^\/\?]+)/i,
            /linkedin\.com\/pub\/([^\/\?]+)/i,
            /linkedin\.com\/profile\/view\?id=([^&]+)/i,
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return `https://www.linkedin.com/in/${match[1]}/`;
            }
        }
        return url.includes('linkedin.com') ? url : null;
    }
    /**
     * Extract company LinkedIn URLs from uploaded candidate data
     */
    extractCompanyLinkedInUrls(candidates) {
        const companyUrls = [];
        candidates.forEach(candidate => {
            if (candidate.company) {
                // Try to find LinkedIn URL in the company field
                const linkedInMatch = candidate.company.match(/linkedin\.com\/company\/([^\/\s]+)/i);
                if (linkedInMatch) {
                    companyUrls.push(`https://www.linkedin.com/company/${linkedInMatch[1]}/`);
                }
            }
            // Check if there's a separate LinkedIn URL field
            if (candidate.linkedinUrl && candidate.linkedinUrl.includes('linkedin.com/company/')) {
                companyUrls.push(candidate.linkedinUrl);
            }
        });
        // Remove duplicates
        return Array.from(new Set(companyUrls));
    }
    /**
     * Search LinkedIn profiles using Apify actors based on available data
     */
    async searchProfilesWithApify(name, title, company, location, maxResults = 20, candidates) {
        try {
            console.log(`Searching LinkedIn profiles with Apify for: ${name} ${title ? `(${title})` : ''} ${company ? `at ${company}` : ''}`);
            if (!process.env.APIFY_API_TOKEN) {
                console.warn('APIFY_API_TOKEN not configured. Cannot use Apify search.');
                return null;
            }
            // Check if any candidates have LinkedIn URLs - if so, use dev_fusion actor
            if (candidates && candidates.length > 0) {
                const candidateWithLinkedIn = candidates.find(c => c.linkedinUrl && c.linkedinUrl.includes('linkedin.com/in/'));
                if (candidateWithLinkedIn) {
                    console.log(`Found candidate with LinkedIn URL: ${candidateWithLinkedIn.linkedinUrl}, using dev_fusion actor`);
                    const devFusionData = await this.getProfileWithDevFusion(candidateWithLinkedIn.linkedinUrl);
                    if (devFusionData) {
                        // Save the dev_fusion results
                        this.saveDevFusionResults(devFusionData, candidateWithLinkedIn.linkedinUrl);
                        // Update database with the fetched LinkedIn data
                        try {
                            // Update candidate record
                            await ResumeDataService.updateCandidateWithLinkedInData(candidateWithLinkedIn.id, devFusionData, 'dev_fusion');
                            // Update resume data if available
                            if (candidateWithLinkedIn.resumeDataId) {
                                await ResumeDataService.updateResumeDataWithLinkedIn(candidateWithLinkedIn.resumeDataId, devFusionData, 'dev_fusion');
                            }
                        }
                        catch (dbError) {
                            console.warn('Failed to update database with LinkedIn data:', dbError);
                        }
                        // Return the LinkedIn URL for further processing
                        return candidateWithLinkedIn.linkedinUrl;
                    }
                    else {
                        console.log('Dev_fusion actor failed, falling back to harvestapi search');
                    }
                }
            }
            // Prepare search input for harvestapi
            const searchInput = {
                profileScraperMode: "Full",
                maxItems: maxResults,
                locations: location ? [location] : [],
                currentJobTitles: title ? [title] : [],
            };
            // Extract company LinkedIn URLs from uploaded data
            if (candidates && candidates.length > 0) {
                const companyUrls = this.extractCompanyLinkedInUrls(candidates);
                if (companyUrls.length > 0) {
                    searchInput.currentCompanies = companyUrls;
                    searchInput.pastCompanies = companyUrls;
                    console.log(`Using ${companyUrls.length} company LinkedIn URLs from uploaded data`);
                }
            }
            // Add company if provided
            if (company) {
                if (!searchInput.currentCompanies)
                    searchInput.currentCompanies = [];
                searchInput.currentCompanies.push(company);
            }
            // Split name into first and last name if possible
            const nameParts = name.trim().split(/\s+/);
            if (nameParts.length >= 2) {
                searchInput.firstNames = [nameParts[0]];
                searchInput.lastNames = [nameParts[nameParts.length - 1]];
            }
            else if (nameParts.length === 1) {
                searchInput.firstNames = [nameParts[0]];
            }
            console.log('Apify search input:', JSON.stringify(searchInput, null, 2));
            // Run the harvestapi Apify actor
            const run = await this.apifyClient.actor("harvestapi/linkedin-profile-search").call(searchInput);
            // Fetch results
            const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
            // Save the raw harvestapi results
            const searchQuery = `${name} ${title || ''} ${company || ''} ${location || ''}`.trim();
            this.saveHarvestApiResults(items, searchQuery);
            if (!items || items.length === 0) {
                console.log('No LinkedIn profiles found with Apify search');
                return null;
            }
            console.log(`Found ${items.length} LinkedIn profiles with Apify search`);
            // If we have results, use the first one (no scoring needed)
            if (items.length > 0) {
                const firstResult = items[0];
                console.log('Using first result from Apify search:', {
                    name: firstResult.firstName + ' ' + firstResult.lastName,
                    currentPosition: firstResult['currentPosition/0/companyName'],
                    location: firstResult['location/linkedinText'],
                    linkedinUrl: firstResult.linkedinUrl
                });
                return typeof firstResult.linkedinUrl === 'string' ? firstResult.linkedinUrl : null;
            }
            console.log('No LinkedIn profiles found with Apify search');
            return null;
        }
        catch (error) {
            console.error('Apify LinkedIn search failed:', error);
            return null;
        }
    }
    /**
     * Search LinkedIn profiles by name and company
     * Enhanced version that uses Apify search
     */
    async searchProfiles(name, company, title, location, candidates) {
        try {
            // Use Apify search only - no URL generation fallback
            const apifyResult = await this.searchProfilesWithApify(name, title, company, location, 20, candidates);
            if (apifyResult) {
                return apifyResult;
            }
            // If no results found, return null instead of generating fake URLs
            console.log('No LinkedIn profiles found with Apify search');
            return null;
        }
        catch (error) {
            console.error('LinkedIn profile search failed:', error);
            return null;
        }
    }
    /**
     * Search LinkedIn profiles with scoring and return multiple results
     * This method now uses Apify search
     */
    async searchProfilesWithScoring(name, title, company, location, maxResults = 10, candidates) {
        try {
            console.log(`Searching LinkedIn profiles for: ${name} ${title ? `(${title})` : ''} ${company ? `at ${company}` : ''}`);
            // Use Apify search
            const apifyResult = await this.searchProfilesWithApify(name, title, company, location, maxResults, candidates);
            if (apifyResult) {
                return apifyResult;
            }
            console.log('No LinkedIn search results found');
            return null;
        }
        catch (error) {
            console.error('LinkedIn profile search with scoring failed:', error);
            return null;
        }
    }
    // Removed findBestApifyMatch method - no longer needed since we use first result
    // Removed calculateSimpleNameMatch method - no longer needed
    /**
     * Calculate name matching score for Apify results
     */
    calculateNameMatchScoreForApify(result, targetName) {
        const resultName = result.name;
        if (!resultName)
            return 0;
        const targetNormalized = targetName.toLowerCase().replace(/[^a-z\s]/g, '');
        const resultNormalized = resultName.toLowerCase().replace(/[^a-z\s]/g, '');
        // Exact match
        if (targetNormalized === resultNormalized)
            return 1.0;
        // Check if all words from target name are present in result name
        const targetWords = targetNormalized.split(/\s+/).filter(word => word.length > 1);
        const resultWords = resultNormalized.split(/\s+/).filter(word => word.length > 1);
        if (targetWords.length === 0)
            return 0;
        const matchingWords = targetWords.filter(word => resultWords.some(resultWord => resultWord.includes(word) || word.includes(resultWord)));
        return matchingWords.length / targetWords.length;
    }
    /**
     * Calculate title matching score
     */
    calculateTitleMatchScore(resultTitle, targetTitle) {
        const resultNormalized = resultTitle.toLowerCase().replace(/[^a-z\s]/g, '');
        const targetNormalized = targetTitle.toLowerCase().replace(/[^a-z\s]/g, '');
        // Exact match
        if (resultNormalized === targetNormalized)
            return 1.0;
        // Check for key terms
        const targetWords = targetNormalized.split(/\s+/).filter(word => word.length > 2);
        const resultWords = resultNormalized.split(/\s+/).filter(word => word.length > 2);
        if (targetWords.length === 0)
            return 0;
        const matchingWords = targetWords.filter(word => resultWords.some(resultWord => resultWord.includes(word) || word.includes(resultWord)));
        return matchingWords.length / targetWords.length;
    }
    /**
     * Calculate company matching score
     */
    calculateCompanyMatchScore(resultCompany, targetCompany) {
        const resultNormalized = resultCompany.toLowerCase().replace(/[^a-z\s]/g, '');
        const targetNormalized = targetCompany.toLowerCase().replace(/[^a-z\s]/g, '');
        // Exact match
        if (resultNormalized === targetNormalized)
            return 1.0;
        // Check for key terms
        const targetWords = targetNormalized.split(/\s+/).filter(word => word.length > 2);
        const resultWords = resultNormalized.split(/\s+/).filter(word => word.length > 2);
        if (targetWords.length === 0)
            return 0;
        const matchingWords = targetWords.filter(word => resultWords.some(resultWord => resultWord.includes(word) || word.includes(resultWord)));
        return matchingWords.length / targetWords.length;
    }
    /**
     * Calculate location matching score
     */
    calculateLocationMatchScore(resultLocation, targetLocation) {
        const resultNormalized = resultLocation.toLowerCase().replace(/[^a-z\s]/g, '');
        const targetNormalized = targetLocation.toLowerCase().replace(/[^a-z\s]/g, '');
        // Exact match
        if (resultNormalized === targetNormalized)
            return 1.0;
        // Check for key terms
        const targetWords = targetNormalized.split(/\s+/).filter(word => word.length > 2);
        const resultWords = resultNormalized.split(/\s+/).filter(word => word.length > 2);
        if (targetWords.length === 0)
            return 0;
        const matchingWords = targetWords.filter(word => resultWords.some(resultWord => resultWord.includes(word) || word.includes(resultWord)));
        return matchingWords.length / targetWords.length;
    }
    /**
     * Calculate snippet relevance score (DEPRECATED)
     */
    calculateSnippetRelevance(snippet, targetName, targetTitle, targetCompany) {
        console.warn('calculateSnippetRelevance is deprecated.');
        const snippetLower = snippet.toLowerCase();
        let relevanceScore = 0;
        // Name in snippet
        if (snippetLower.includes(targetName.toLowerCase())) {
            relevanceScore += 0.5;
        }
        // Title in snippet
        if (targetTitle && snippetLower.includes(targetTitle.toLowerCase())) {
            relevanceScore += 0.3;
        }
        // Company in snippet
        if (targetCompany && snippetLower.includes(targetCompany.toLowerCase())) {
            relevanceScore += 0.2;
        }
        return relevanceScore;
    }
    /**
     * Extract name from title if available
     */
    extractNameFromTitle(title) {
        // Simple extraction - look for patterns like "John Smith - Software Engineer"
        const nameMatch = title.match(/^([^-|–]+)/);
        return nameMatch ? nameMatch[1].trim() : null;
    }
    /**
     * Enrich candidate profile using LinkedIn search and scraping
     */
    async enrichProfile(linkedinUrl, name, company, title, location, candidates) {
        let foundLinkedInUrl = null;
        try {
            let profileUrl = linkedinUrl;
            // If no LinkedIn URL provided or URL doesn't exist, search for it
            if (!profileUrl && name) {
                profileUrl = await this.searchProfiles(name, company, title, location, candidates) || undefined;
                if (profileUrl) {
                    foundLinkedInUrl = profileUrl; // Store the found URL
                    console.log(`Found LinkedIn URL through search: ${foundLinkedInUrl}`);
                }
            }
            else if (profileUrl) {
                foundLinkedInUrl = profileUrl; // Use the provided URL
            }
            // If no LinkedIn URL found, create a basic profile
            if (!profileUrl) {
                console.log(`No LinkedIn profile found for ${name}, creating basic profile`);
                return this.createBasicProfile(name, company, title, location);
            }
            // Check if APIFY_API_TOKEN is configured
            if (!process.env.APIFY_API_TOKEN) {
                throw new Error('APIFY_API_TOKEN not configured. LinkedIn enrichment requires valid API credentials.');
            }
            console.log(`Enriching LinkedIn profile for: ${name} (${profileUrl})`);
            // If we have a LinkedIn URL, try to use dev_fusion actor for direct profile scraping
            if (profileUrl && profileUrl.includes('linkedin.com/in/')) {
                console.log('LinkedIn URL detected, using dev_fusion actor for direct profile scraping');
                const devFusionData = await this.getProfileWithDevFusion(profileUrl);
                if (devFusionData) {
                    // Save the dev_fusion results
                    this.saveDevFusionResults(devFusionData, profileUrl);
                    // Transform dev_fusion data to our format
                    const enrichedProfile = this.transformDevFusionData(devFusionData);
                    enrichedProfile.profileUrl = profileUrl;
                    // Update database with the fetched LinkedIn data
                    try {
                        if (candidates && candidates.length > 0) {
                            // Find the candidate that matches this LinkedIn URL
                            const matchingCandidate = candidates.find(c => c.linkedinUrl === profileUrl ||
                                c.linkedinUrl === profileUrl.replace(/\/$/, '') ||
                                profileUrl.includes(c.name?.split(' ')[0] || ''));
                            if (matchingCandidate) {
                                // Update candidate record
                                await ResumeDataService.updateCandidateWithLinkedInData(matchingCandidate.id, devFusionData, 'dev_fusion');
                                // Update resume data if available
                                if (matchingCandidate.resumeDataId) {
                                    await ResumeDataService.updateResumeDataWithLinkedIn(matchingCandidate.resumeDataId, devFusionData, 'dev_fusion');
                                }
                            }
                        }
                    }
                    catch (dbError) {
                        console.warn('Failed to update database with LinkedIn data:', dbError);
                    }
                    console.log('Successfully enriched profile using dev_fusion actor');
                    return enrichedProfile;
                }
                else {
                    console.log('Dev_fusion actor failed, falling back to harvestapi search');
                }
            }
            // Fallback to harvestapi search if no LinkedIn URL or dev_fusion failed
            console.log('Using harvestapi actor for profile search/enrichment');
            try {
                // Search again with the same parameters to get full profile data
                const searchInput = {
                    profileScraperMode: "Full",
                    maxItems: 20,
                    locations: location ? [location] : [],
                    currentJobTitles: title ? [title] : [],
                    firstNames: name ? [name.split(' ')[0]] : [],
                    lastNames: name ? [name.split(' ').slice(-1)[0]] : [],
                };
                // Extract company LinkedIn URLs from uploaded data
                if (candidates && candidates.length > 0) {
                    const companyUrls = this.extractCompanyLinkedInUrls(candidates);
                    if (companyUrls.length > 0) {
                        searchInput.currentCompanies = companyUrls;
                        searchInput.pastCompanies = companyUrls;
                    }
                }
                // Add company if provided
                if (company) {
                    if (!searchInput.currentCompanies)
                        searchInput.currentCompanies = [];
                    searchInput.currentCompanies.push(company);
                }
                console.log('Enrichment search input:', JSON.stringify(searchInput, null, 2));
                // Using the harvestapi LinkedIn Profile Search actor
                const run = await this.apifyClient.actor("harvestapi/linkedin-profile-search").call(searchInput);
                const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
                // Save the raw harvestapi results
                const searchQuery = `Profile enrichment for: ${name || 'Unknown'} - ${profileUrl}`;
                this.saveHarvestApiResults(items, searchQuery);
                if (!items || items.length === 0) {
                    // If no profile found, create a basic profile with available data
                    console.log(`No profile data found for enrichment, creating basic profile`);
                    const basicProfile = this.createBasicProfile(name, company, title, location, profileUrl);
                    return basicProfile;
                }
                // Find the profile that matches our LinkedIn URL
                let profileData = null;
                for (const item of items) {
                    if (item.linkedinUrl === profileUrl || item.linkedinUrl === foundLinkedInUrl) {
                        profileData = item;
                        break;
                    }
                }
                // If no exact match, use the first result
                if (!profileData && items.length > 0) {
                    profileData = items[0];
                    console.log(`No exact URL match found, using first result: ${profileData.linkedinUrl}`);
                }
                if (!profileData) {
                    console.log(`No suitable profile data found, creating basic profile`);
                    const basicProfile = this.createBasicProfile(name, company, title, location, profileUrl);
                    return basicProfile;
                }
                const enrichedProfile = this.transformHarvestApiData(profileData);
                // Ensure the found LinkedIn URL is set in the enriched profile
                if (foundLinkedInUrl) {
                    enrichedProfile.profileUrl = foundLinkedInUrl;
                    console.log(`Set LinkedIn URL in enriched profile: ${foundLinkedInUrl}`);
                }
                // Update database with the fetched LinkedIn data
                try {
                    if (candidates && candidates.length > 0) {
                        // Find the candidate that matches this profile
                        const matchingCandidate = candidates.find(c => c.linkedinUrl === profileUrl ||
                            c.linkedinUrl === foundLinkedInUrl ||
                            c.name === enrichedProfile.name ||
                            (c.title && c.title.toLowerCase().includes(enrichedProfile.title?.toLowerCase() || '')));
                        if (matchingCandidate) {
                            // Update candidate record
                            await ResumeDataService.updateCandidateWithLinkedInData(matchingCandidate.id, profileData, 'harvestapi');
                            // Update resume data if available
                            if (matchingCandidate.resumeDataId) {
                                await ResumeDataService.updateResumeDataWithLinkedIn(matchingCandidate.resumeDataId, profileData, 'harvestapi');
                            }
                        }
                    }
                }
                catch (dbError) {
                    console.warn('Failed to update database with LinkedIn data:', dbError);
                }
                return enrichedProfile;
            }
            catch (apifyError) {
                // Handle specific Apify errors
                if (apifyError.statusCode === 403 && apifyError.type === 'insufficient-permissions') {
                    throw new Error('Apify API access denied. Please check your subscription and API credentials.');
                }
                else if (apifyError.statusCode === 429) {
                    throw new Error('Apify API rate limit exceeded. Please try again later.');
                }
                else if (apifyError.statusCode === 500) {
                    throw new Error('Apify service temporarily unavailable. Please try again later.');
                }
                else {
                    throw new Error(`Apify API error: ${apifyError.message || 'Unknown error occurred'}`);
                }
            }
        }
        catch (error) {
            console.error('LinkedIn profile enrichment failed:', error);
            throw error; // Re-throw the error instead of falling back to mock data
        }
    }
    /**
     * Transform dev_fusion LinkedIn profile data to our LinkedIn profile format
     */
    transformDevFusionData(data) {
        console.log('🔍 Raw dev_fusion data structure:');
        console.log('Keys:', Object.keys(data));
        // Handle the nested structure from dev_fusion actor
        let profileData = data;
        if (data.rawData) {
            profileData = data.rawData;
            console.log('📁 Found rawData, using nested structure');
        }
        console.log('Profile data keys:', Object.keys(profileData));
        console.log('🔍 Experiences array:', JSON.stringify(profileData.experiences, null, 2));
        // Extract experience data from the dev_fusion format
        const experiences = [];
        if (profileData.experiences && Array.isArray(profileData.experiences)) {
            profileData.experiences.forEach((exp) => {
                // Extract company from subtitle (e.g., "Aimplify · Full-time" -> "Aimplify")
                let companyName = 'Unknown';
                if (exp.subtitle) {
                    // Split by "·" and take the first part (company name)
                    companyName = exp.subtitle.split('·')[0].trim();
                    console.log(`🔍 Extracted company from subtitle: "${exp.subtitle}" -> "${companyName}"`);
                }
                else if (exp.company) {
                    companyName = exp.company;
                    console.log(`🔍 Using exp.company: "${companyName}"`);
                }
                else if (exp.companyName) {
                    companyName = exp.companyName;
                    console.log(`🔍 Using exp.companyName: "${companyName}"`);
                }
                else {
                    console.log(`⚠️ No company data found for experience: ${exp.title}`);
                }
                experiences.push({
                    title: exp.title || exp.position || exp.jobTitle || 'Unknown',
                    company: companyName,
                    duration: exp.duration || exp.timePeriod || exp.currentJobDuration || 'Unknown',
                    description: exp.description || ''
                });
            });
        }
        // Extract education data
        const education = [];
        if (data.education && Array.isArray(data.education)) {
            data.education.forEach((edu) => {
                education.push({
                    school: edu.school || edu.institution || 'Unknown',
                    degree: edu.degree || 'Unknown',
                    field: edu.field || edu.major || 'Unknown',
                    years: edu.years || edu.timePeriod || 'Unknown'
                });
            });
        }
        // Extract skills
        const skills = data.skills || data.skill || [];
        // Extract certifications
        const certifications = [];
        if (data.certifications && Array.isArray(data.certifications)) {
            data.certifications.forEach((cert) => {
                certifications.push({
                    name: cert.name || cert.title || 'Unknown',
                    issuer: cert.issuer || cert.organization || 'Unknown',
                    date: cert.date || cert.issuedDate || 'Unknown'
                });
            });
        }
        // Determine current company and position from most recent experience
        let currentCompany = 'Unknown';
        let currentPosition = profileData.headline || profileData.title || profileData.jobTitle || 'Unknown';
        // First, try to get company from experience data (most reliable)
        if (experiences.length > 0) {
            // Use the first experience entry as it's typically the most recent
            const mostRecent = experiences[0];
            currentCompany = mostRecent.company;
            currentPosition = mostRecent.title;
            console.log(`✅ Using most recent experience: ${currentPosition} at ${currentCompany}`);
            console.log(`🔍 Experience data:`, JSON.stringify(mostRecent, null, 2));
            // If company is still "Unknown", try subtitle fallback
            if (currentCompany === 'Unknown' && profileData.experiences && Array.isArray(profileData.experiences) && profileData.experiences.length > 0) {
                const rawMostRecent = profileData.experiences[0];
                console.log(`🔍 Raw experience data for fallback:`, JSON.stringify(rawMostRecent, null, 2));
                if (rawMostRecent.subtitle) {
                    currentCompany = rawMostRecent.subtitle.split('·')[0].trim();
                    console.log(`✅ Using subtitle fallback after Unknown: ${currentPosition} at ${currentCompany}`);
                }
                else if (rawMostRecent.company) {
                    currentCompany = rawMostRecent.company;
                    console.log(`✅ Using raw company fallback: ${currentPosition} at ${currentCompany}`);
                }
                else if (rawMostRecent.companyName) {
                    currentCompany = rawMostRecent.companyName;
                    console.log(`✅ Using raw companyName fallback: ${currentPosition} at ${currentCompany}`);
                }
                else if (rawMostRecent.companyLink1) {
                    // Extract company name from LinkedIn company URL
                    const companyUrl = rawMostRecent.companyLink1;
                    const companyName = companyUrl.split('/company/')[1]?.split('/')[0] || 'Unknown';
                    currentCompany = companyName;
                    console.log(`✅ Using companyLink1 fallback: ${currentPosition} at ${currentCompany}`);
                }
                else if (rawMostRecent.title && rawMostRecent.title.includes('(') && rawMostRecent.title.includes(')')) {
                    // Extract company from title like "Product Manager - AI solutions (Aimplify)"
                    const match = rawMostRecent.title.match(/\(([^)]+)\)/);
                    if (match) {
                        currentCompany = match[1];
                        console.log(`✅ Using title extraction fallback: ${currentPosition} at ${currentCompany}`);
                    }
                }
            }
        }
        // Fallback: try to extract from subtitle directly
        else if (profileData.experiences && Array.isArray(profileData.experiences) && profileData.experiences.length > 0) {
            const mostRecent = profileData.experiences[0];
            if (mostRecent.subtitle) {
                currentCompany = mostRecent.subtitle.split('·')[0].trim();
                currentPosition = mostRecent.title || 'Unknown';
                console.log(`✅ Using subtitle fallback: ${currentPosition} at ${currentCompany}`);
            }
        }
        // Additional fallback: try different possible company fields from profileData
        else if (profileData.companyName) {
            currentCompany = profileData.companyName;
            console.log(`✅ Using profileData.companyName: ${currentCompany}`);
        }
        else if (profileData.company) {
            currentCompany = profileData.company;
            console.log(`✅ Using profileData.company: ${currentCompany}`);
        }
        else if (profileData.currentCompany) {
            currentCompany = profileData.currentCompany;
            console.log(`✅ Using profileData.currentCompany: ${currentCompany}`);
        }
        // Final comprehensive check - if still "Unknown", try all possible sources
        if (currentCompany === 'Unknown' && profileData.experiences && Array.isArray(profileData.experiences) && profileData.experiences.length > 0) {
            const rawMostRecent = profileData.experiences[0];
            console.log(`🔍 Final fallback attempt with raw data:`, JSON.stringify(rawMostRecent, null, 2));
            // Try all possible company fields
            if (rawMostRecent.subtitle) {
                currentCompany = rawMostRecent.subtitle.split('·')[0].trim();
                console.log(`✅ Final subtitle fallback: ${currentPosition} at ${currentCompany}`);
            }
            else if (rawMostRecent.company) {
                currentCompany = rawMostRecent.company;
                console.log(`✅ Final company fallback: ${currentPosition} at ${currentCompany}`);
            }
            else if (rawMostRecent.companyName) {
                currentCompany = rawMostRecent.companyName;
                console.log(`✅ Final companyName fallback: ${currentPosition} at ${currentCompany}`);
            }
            else if (rawMostRecent.companyLink1) {
                const companyUrl = rawMostRecent.companyLink1;
                const companyName = companyUrl.split('/company/')[1]?.split('/')[0] || 'Unknown';
                currentCompany = companyName;
                console.log(`✅ Final companyLink1 fallback: ${currentPosition} at ${currentCompany}`);
            }
            else if (rawMostRecent.title && rawMostRecent.title.includes('(') && rawMostRecent.title.includes(')')) {
                // Extract company from title like "Product Manager - AI solutions (Aimplify)"
                const match = rawMostRecent.title.match(/\(([^)]+)\)/);
                if (match) {
                    currentCompany = match[1];
                    console.log(`✅ Final title extraction fallback: ${currentPosition} at ${currentCompany}`);
                }
            }
        }
        console.log(`🔍 Final company extraction: ${currentCompany} for position: ${currentPosition}`);
        console.log(`🔍 All available company fields:`, {
            subtitle: profileData.experiences?.[0]?.subtitle,
            company: profileData.experiences?.[0]?.company,
            companyName: profileData.experiences?.[0]?.companyName,
            companyLink1: profileData.experiences?.[0]?.companyLink1
        });
        return {
            name: profileData.name || profileData.fullName || 'Unknown',
            title: currentPosition,
            company: currentCompany,
            skills: Array.isArray(skills) ? skills : [skills].filter(Boolean),
            openToWork: profileData.openToWork || false,
            lastActive: profileData.lastActive || profileData.lastSeen || 'Unknown',
            profileUrl: profileData.profileUrl || profileData.linkedinUrl || profileData.url,
            jobHistory: experiences.map(exp => ({
                role: exp.title,
                company: exp.company,
                duration: exp.duration
            })),
            recentActivity: profileData.recentActivity || [],
            headline: profileData.headline || profileData.title,
            location: profileData.location || profileData.geographicArea || profileData.addressWithCountry,
            summary: profileData.summary || profileData.about || profileData.description,
            experience: experiences,
            education: education,
            connections: profileData.connections || profileData.connectionsCount || 0,
            profilePicture: profileData.profilePicture || profileData.profileImage || profileData.profilePic,
            currentCompany: currentCompany,
            currentPosition: currentPosition,
            industry: profileData.industry || profileData.companyIndustry,
            languages: profileData.languages || [],
            certifications: certifications,
            posts: profileData.posts || profileData.updates || []
        };
    }
    /**
     * Transform harvestapi LinkedIn search response data to our LinkedIn profile format
     */
    transformHarvestApiData(data) {
        console.log('Transforming harvestapi data:', JSON.stringify(data, null, 2));
        // Extract experience data from the harvestapi format
        const experiences = [];
        if (data.experience && Array.isArray(data.experience)) {
            data.experience.forEach((exp) => {
                experiences.push({
                    title: exp.position || 'Unknown Role',
                    company: exp.companyName || 'Unknown Company',
                    duration: exp.duration || 'Unknown Duration',
                    description: exp.description || '',
                });
            });
        }
        // Extract education data
        const education = [];
        if (data.education && Array.isArray(data.education)) {
            data.education.forEach((edu) => {
                education.push({
                    school: edu.schoolName || 'Unknown School',
                    degree: edu.degree || 'Unknown Degree',
                    field: edu.fieldOfStudy || 'Unknown Field',
                    years: edu.period || 'Unknown Period',
                });
            });
        }
        // Extract skills
        const skills = [];
        if (data.skills && Array.isArray(data.skills)) {
            data.skills.forEach((skill) => {
                if (skill.name) {
                    skills.push(skill.name);
                }
            });
        }
        // Extract certifications
        const certifications = [];
        if (data.certifications && Array.isArray(data.certifications)) {
            data.certifications.forEach((cert) => {
                certifications.push({
                    name: cert.title || 'Unknown Certification',
                    issuer: cert.issuedBy || 'Unknown Issuer',
                    date: cert.issuedAt || 'Unknown Date',
                });
            });
        }
        // Get current position info from currentPosition array
        let currentPosition = 'Unknown Company';
        let currentRole = 'Unknown Title';
        if (data.currentPosition && Array.isArray(data.currentPosition) && data.currentPosition.length > 0) {
            currentPosition = data.currentPosition[0].companyName || 'Unknown Company';
            currentRole = data.currentPosition[0].position || 'Unknown Title';
        }
        else if (experiences.length > 0) {
            // Fallback to first experience if currentPosition is not available
            currentPosition = experiences[0].company;
            currentRole = experiences[0].title;
        }
        // Get location from the location object
        let location = 'Unknown Location';
        if (data.location) {
            if (typeof data.location === 'string') {
                location = data.location;
            }
            else if (data.location.linkedinText) {
                location = data.location.linkedinText;
            }
            else if (data.location.parsed && data.location.parsed.text) {
                location = data.location.parsed.text;
            }
        }
        // Parse connections count
        let connections = undefined;
        if (data.connectionsCount) {
            const connectionsStr = data.connectionsCount.toString();
            if (connectionsStr.includes('+')) {
                connections = parseInt(connectionsStr.replace('+', ''));
            }
            else {
                connections = parseInt(connectionsStr);
            }
        }
        return {
            // Required fields for our interface
            name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown',
            title: data.headline || currentRole,
            company: currentPosition,
            skills: skills,
            openToWork: data.openToWork === true || data.openToWork === 'true',
            lastActive: "Recently active",
            profileUrl: data.linkedinUrl,
            jobHistory: experiences.slice(0, 3).map(exp => ({
                role: exp.title,
                company: exp.company,
                duration: exp.duration,
            })),
            recentActivity: [], // Not available in search results
            // Additional detailed fields
            headline: data.headline,
            location: location,
            summary: data.about,
            experience: experiences,
            education: education,
            connections: connections,
            profilePicture: data.photo,
            currentCompany: currentPosition,
            currentPosition: currentRole,
            industry: undefined, // Not directly available
            languages: undefined, // Not directly available
            certifications: certifications,
            posts: [], // Not available in search results
        };
    }
    /**
     * Transform Apify response data to our LinkedIn profile format (DEPRECATED)
     */
    transformApifyData(data) {
        const positions = data.positions || [];
        const skills = data.skills || [];
        return {
            // Required fields for our interface
            name: data.name || data.fullName || 'Unknown',
            title: data.headline || positions[0]?.title || 'Unknown Title',
            company: positions[0]?.companyName || 'Unknown Company',
            skills: Array.isArray(skills) ? skills : [],
            openToWork: data.openToWork === true || data.openToWork === 'true',
            lastActive: data.lastActivityTime || 'Recently active',
            profileUrl: data.profileUrl || data.url,
            jobHistory: positions.slice(0, 3).map((pos) => ({
                role: pos.title || 'Unknown Role',
                company: pos.companyName || 'Unknown Company',
                duration: pos.date || 'Unknown Duration',
            })),
            recentActivity: data.posts?.slice(0, 3).map((post) => post.text) || [],
            // Additional detailed fields
            headline: data.headline || data.title,
            location: data.location,
            summary: data.summary || data.about,
            experience: positions.map((pos) => ({
                title: pos.title,
                company: pos.companyName,
                duration: pos.date,
                description: pos.description,
            })),
            education: data.schools?.map((edu) => ({
                school: edu.schoolName,
                degree: edu.degree,
                field: edu.fieldOfStudy,
                years: edu.date,
            })) || [],
            connections: data.connectionsCount,
            profilePicture: data.photoUrl,
            currentCompany: positions[0]?.companyName,
            currentPosition: positions[0]?.title,
            industry: data.industry,
            languages: data.languages,
            certifications: data.certifications?.map((cert) => ({
                name: cert.name,
                issuer: cert.issuer,
                date: cert.date,
            })) || [],
            posts: data.posts?.slice(0, 5).map((post) => ({
                text: post.text,
                date: post.date,
                engagement: post.totalReactionCount || 0,
            })) || [],
        };
    }
    /**
     * Create a basic LinkedIn profile when no data is found
     */
    createBasicProfile(name, company, title, location, linkedinUrl) {
        return {
            name: name || 'Unknown',
            title: title || 'Professional',
            company: company || 'Unknown Company',
            skills: [],
            openToWork: false,
            lastActive: "Recently active",
            profileUrl: linkedinUrl,
            jobHistory: [],
            recentActivity: [],
            // Additional detailed fields
            headline: title,
            location: location,
            summary: undefined,
            experience: [],
            education: [],
            connections: undefined,
            profilePicture: undefined,
            currentCompany: company,
            currentPosition: title,
            industry: undefined,
            languages: undefined,
            certifications: [],
            posts: [],
        };
    }
    /**
     * Analyze if candidate appears to be open to work based on profile signals
     */
    analyzeOpenToWork(data) {
        const openSignals = [
            'open to work',
            'seeking',
            'looking for',
            'available',
            'opportunity',
            'job search',
            'actively looking'
        ];
        // For harvestapi data, check headline, about, and experience descriptions
        const profile = `${data.headline || ''} ${data.about || ''}`.toLowerCase();
        // Check experience descriptions for open to work signals
        let experienceText = '';
        if (data.experience && Array.isArray(data.experience)) {
            data.experience.forEach((exp) => {
                if (exp.description) {
                    experienceText += ' ' + exp.description.toLowerCase();
                }
            });
        }
        const fullText = `${profile} ${experienceText}`.toLowerCase();
        return openSignals.some(signal => fullText.includes(signal));
    }
    /**
     * Batch enrich multiple LinkedIn profiles
     */
    async batchEnrichProfiles(urls) {
        const results = [];
        for (const url of urls) {
            try {
                const profile = await this.enrichProfile(url);
                results.push({ url, profile });
                // Rate limiting - wait 2 seconds between requests to avoid blocking
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            catch (error) {
                results.push({
                    url,
                    profile: null,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return results;
    }
    /**
     * Analyze profile for job fit and engagement signals
     */
    analyzeProfileSignals(profile) {
        const insights = [];
        let openToWorkSignals = 0;
        let engagementScore = 0;
        let stabilityScore = 0;
        let skillRelevance = 0;
        // Analyze open to work signals
        if (profile.headline?.toLowerCase().includes('open to')) {
            openToWorkSignals += 30;
            insights.push('Profile indicates openness to opportunities');
        }
        if (profile.posts && profile.posts.length > 0) {
            const recentActivity = profile.posts.some(post => new Date(post.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
            if (recentActivity) {
                engagementScore += 25;
                insights.push('Active on LinkedIn with recent posts');
            }
            const avgEngagement = profile.posts.reduce((sum, post) => sum + post.engagement, 0) / profile.posts.length;
            engagementScore += Math.min(avgEngagement / 10, 25);
        }
        // Analyze job stability
        if (profile.experience && profile.experience.length > 0) {
            const avgTenure = profile.experience.length > 0 ?
                profile.experience.reduce((sum, exp) => {
                    const years = this.parseDuration(exp.duration);
                    return sum + years;
                }, 0) / profile.experience.length : 0;
            stabilityScore = Math.min(avgTenure * 10, 40);
            if (avgTenure > 2) {
                insights.push(`Strong job stability with ${avgTenure.toFixed(1)} years average tenure`);
            }
        }
        // Analyze connections (network strength)
        if (profile.connections) {
            if (profile.connections > 500) {
                engagementScore += 15;
                insights.push('Strong professional network');
            }
        }
        return {
            openToWorkSignals: Math.min(openToWorkSignals, 40),
            engagementScore: Math.min(engagementScore, 30),
            stabilityScore: Math.min(stabilityScore, 40),
            skillRelevance: skillRelevance,
            insights
        };
    }
    /**
     * Parse duration string to years (approximate)
     */
    parseDuration(duration) {
        if (!duration)
            return 0;
        const yearMatch = duration.match(/(\d+)\s*(?:year|yr)/i);
        const monthMatch = duration.match(/(\d+)\s*(?:month|mo)/i);
        let years = yearMatch ? parseInt(yearMatch[1]) : 0;
        const months = monthMatch ? parseInt(monthMatch[1]) : 0;
        years += months / 12;
        return years;
    }
}
export const linkedInService = new LinkedInService();
