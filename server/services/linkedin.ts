import { ApifyClient } from 'apify-client';
import * as fs from 'fs';
import * as path from 'path';
import { request } from 'node:https';
// import { ResumeDataService } from './resumeDataService.js'; // Commented out - using consolidated candidates table

const LINKEDIN_COMPANY_SYNONYM_PAIRS: Array<[string, string]> = [
  ['private', 'pvt'],
  ['pvt', 'private'],
  ['limited', 'ltd'],
  ['ltd', 'limited'],
  ['technologies', 'technology'],
  ['technology', 'technologies'],
  ['technology', 'tech'],
  ['tech', 'technology'],
  ['solutions', 'solution'],
  ['solution', 'solutions'],
  ['services', 'service'],
  ['service', 'services'],
  ['corporation', 'corp'],
  ['corp', 'corporation'],
  ['company', 'co'],
  ['co', 'company'],
  ['international', 'intl'],
  ['intl', 'international'],
];

const LINKEDIN_COMPANY_FILLER_TOKENS = new Set([
  'private',
  'pvt',
  'limited',
  'ltd',
  'inc',
  'llp',
  'llc',
  'co',
  'company',
  'corp',
  'corporation',
  'plc',
  'group',
  'holdings',
  'the',
]);

const RESUME_FILTER_LIMIT = 5;
const MAX_COMPANY_VALIDATIONS = 8;
const LINKEDIN_BODY_MAX_BYTES = 60000;
const LINKEDIN_NOT_FOUND_PATTERNS = [
  'page not found',
  'page can’t be found',
  'page can\'t be found',
  'company or school not found',
  'try searching for another company',
  'doesn\'t exist',
  'doesn’t exist',
  'we couldn’t find',
  'we couldn\'t find',
  'profile is unavailable',
  'profile not found',
  'not a valid company'
];

interface LinkedInProfile {
  name: string;
  title: string;
  company: string;
  skills: string[];
  openToWork: boolean;
  lastActive: string;
  profileUrl?: string;
  jobHistory?: Array<{
    role: string;
    company: string;
    duration: string;
  }>;
  recentActivity?: string[];
  // Original detailed fields for future use
  headline?: string;
  location?: string;
  summary?: string;
  experience?: Array<{
    title: string;
    company: string;
    duration: string;
    description?: string;
  }>;
  education?: Array<{
    school: string;
    degree: string;
    field: string;
    years: string;
  }>;
  connections?: number;
  profilePicture?: string;
  currentCompany?: string;
  currentPosition?: string;
  industry?: string;
  languages?: string[];
  certifications?: Array<{
    name: string;
    issuer: string;
    date: string;
  }>;
  posts?: Array<{
    text: string;
    date: string;
    engagement: number;
  }>;
}

interface LinkedInSearchResult {
  url: string;
  title: string;
  snippet: string;
  score: number;
  name?: string;
  company?: string;
  location?: string;
}

interface LinkedInSearchResponse {
  query: {
    name: string;
    title?: string;
    company?: string;
    location?: string;
    max_results: number;
  };
  results: LinkedInSearchResult[];
  total_results: number;
  search_time: number;
  timestamp: string;
}

interface ApifyLinkedInSearchInput {
  searchQuery?: string;                 // Fuzzy search query (full name)
  currentCompanies?: string[];
  currentJobTitles?: string[];
  firstNames?: string[];
  lastNames?: string[];
  locations?: string[];
  maxItems?: number;
  pastCompanies?: string[];
  pastJobTitles?: string[];
  profileScraperMode?: string;
  schools?: string[];
  recentlyChangedJobs?: boolean;
  yearsOfExperienceIds?: string[];
  startPage?: number;
}

interface ApifyDevFusionInput {
  profileUrls: string[];
}

interface ApifyLinkedInSearchResult {
  profileUrl: string;
  name: string;
  headline?: string;
  location?: string;
  currentCompany?: string;
  currentPosition?: string;
  summary?: string;
  experience?: Array<{
    title: string;
    company: string;
    duration: string;
  }>;
  education?: Array<{
    school: string;
    degree: string;
    field: string;
  }>;
  skills?: string[];
  connections?: number;
  profilePicture?: string;
}

export class LinkedInService {
  private apifyClient: ApifyClient;
  private lastSearchResults: Map<string, any> = new Map(); // Cache search results to avoid duplicate API calls
  private companyUrlValidationCache: Map<string, boolean> = new Map();
  private readonly linkedInUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private readonly linkedInRequestTimeoutMs = 5000;

  constructor() {
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      console.warn('APIFY_API_TOKEN not found. LinkedIn enrichment will use fallback mode.');
    } else {
      console.log(`✅ APIFY_API_TOKEN loaded: ${apifyToken.substring(0, 20)}...`);
    }
    this.apifyClient = new ApifyClient({
      token: apifyToken,
    });
  }

  /**
   * Use dev_fusion/Linkedin-Profile-Scraper actor to get profile details from LinkedIn URL
   */
  async getProfileWithDevFusion(linkedinUrl: string): Promise<any> {
    try {
      console.log(`Using dev_fusion/Linkedin-Profile-Scraper for URL: ${linkedinUrl}`);
      
      const input: ApifyDevFusionInput = {
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
      
    } catch (error) {
      console.error('Error using dev_fusion actor:', error);
      return null;
    }
  }

  /**
   * Save raw dev_fusion results to a JSON file
   */
  private saveDevFusionResults(data: any, linkedinUrl: string, timestamp: string = new Date().toISOString()): void {
    try {
      // Create results directory if it doesn't exist
      const resultsDir = path.join(process.cwd(), 'devfusion-results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }

      // Create filename with timestamp and profile identifier
      const profileId = linkedinUrl.split('/in/')[1]?.split('?')[0] || 'unknown';
      // Clean profileId to remove invalid filename characters
      const cleanProfileId = profileId.replace(/[<>:"/\\|?*]/g, '-');
      const filename = `devfusion_${cleanProfileId}_${timestamp.replace(/[:.]/g, '-')}.json`;
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
      
    } catch (error) {
      console.error('❌ Failed to save DevFusion results:', error);
    }
  }

  /**
   * Save raw harvestapi results to a JSON file
   */
  private saveHarvestApiResults(data: any, searchQuery: string, timestamp: string = new Date().toISOString()): void {
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
      
    } catch (error) {
      console.error('❌ Failed to save HarvestAPI results:', error);
    }
  }

  /**
   * Save a summary of the results
   */
  private saveResultsSummary(resultData: any, originalFilepath: string): void {
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
        profiles: Array.isArray(resultData.rawData) ? resultData.rawData.map((profile: any, index: number) => ({
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
      
    } catch (error) {
      console.error('❌ Failed to save results summary:', error);
    }
  }

  /**
   * Extract LinkedIn profile URL from various formats
   */
  private normalizeLinkedInUrl(url: string): string | null {
    if (!url) return null;
    
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
  private extractCompanyLinkedInUrls(candidates: any[]): string[] {
    const companyUrls: string[] = [];
    
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

  private getCandidateExperiences(candidate: any): any[] {
    if (!candidate || typeof candidate !== 'object') {
      return [];
    }

    const experiences: any[] = [];
    const sources = [
      candidate.experience,
      candidate.extractedData?.experience,
      candidate.originalData?.experience,
      candidate.resumeData?.experience,
      candidate.enrichedData?.experience,
    ];

    for (const source of sources) {
      if (Array.isArray(source)) {
        for (const item of source) {
          if (item && typeof item === 'object') {
            experiences.push(item);
          }
        }
      }
    }

    return experiences;
  }

  private isCurrentExperience(experience: any, index: number): boolean {
    if (!experience || typeof experience !== 'object') {
      return index === 0;
    }

    if (typeof experience.current === 'boolean') return experience.current;
    if (typeof experience.isCurrent === 'boolean') return experience.isCurrent;
    if (typeof experience.currentlyWorking === 'boolean') return experience.currentlyWorking;
    if (typeof experience.currentlyWorking === 'string') {
      if (/yes/i.test(experience.currentlyWorking)) return true;
      if (/no/i.test(experience.currentlyWorking)) return false;
    }

    const markers = [
      experience.endDate,
      experience.end,
      experience.to,
      experience.period?.end,
      experience.duration,
      experience.status,
    ];

    for (const marker of markers) {
      if (typeof marker === 'string' && /present|current|ongoing|today|now/i.test(marker)) {
        return true;
      }
    }

    for (const marker of markers) {
      if (typeof marker === 'string' && marker.trim().length > 0) {
        return false;
      }
    }

    return index === 0;
  }

  private async extractLinkedInFiltersFromCandidates(candidates: any[]): Promise<{
    currentCompanies: string[];
    pastCompanies: string[];
    currentJobTitles: string[];
    pastJobTitles: string[];
  }> {
    const currentCompanyUrls = new Set<string>();
    const pastCompanyUrls = new Set<string>();
    const currentJobTitles = new Set<string>();
    const pastJobTitles = new Set<string>();

    const companyStates = new Map<string, { displayName: string; isCurrent: boolean; isPast: boolean }>();

    const addJobTitle = (value: unknown, isCurrent: boolean) => {
      if (typeof value !== 'string') return;
      const normalized = value.trim();
      if (normalized.length < 3) return;
      const targetSet = isCurrent ? currentJobTitles : pastJobTitles;
      targetSet.add(normalized);
    };

    const addCompanyName = (value: unknown, isCurrent: boolean) => {
      if (typeof value !== 'string') return;
      const normalized = value.trim();
      if (normalized.length < 2) return;
      const key = normalized.toLowerCase();
      let state = companyStates.get(key);
      if (!state) {
        if (companyStates.size >= MAX_COMPANY_VALIDATIONS) {
          return;
        }
        state = { displayName: normalized, isCurrent: false, isPast: false };
        companyStates.set(key, state);
      }
      if (isCurrent) {
        state.isCurrent = true;
      } else {
        state.isPast = true;
      }
    };

    candidates.forEach(candidate => {
      if (!candidate || typeof candidate !== 'object') {
        return;
      }

      // Extract work experiences FIRST to prioritize actual job titles over resume header
      const experiences = this.getCandidateExperiences(candidate);
      let hasWorkExperience = false;
      
      experiences.forEach((experience, index) => {
        if (!experience || typeof experience !== 'object') return;
        const isCurrent = this.isCurrentExperience(experience, index);
        const companyName =
          experience.company ??
          experience.companyName ??
          experience.employer ??
          experience.organization ??
          experience.organisation ??
          null;
        const jobTitle =
          experience.jobTitle ??
          experience.title ??
          experience.position ??
          experience.role ??
          null;

        if (companyName) {
          addCompanyName(companyName, isCurrent);
          hasWorkExperience = true;
        }
        if (jobTitle) {
          addJobTitle(jobTitle, isCurrent);
        }
      });

      // Only use candidate-level company/title if no work experience was found
      if (!hasWorkExperience) {
        addCompanyName(candidate.currentEmployer ?? candidate.currentCompany ?? candidate.company, true);
        addJobTitle(candidate.currentTitle ?? candidate.title, true);
      }
    });

    const companyEntries = Array.from(companyStates.values());
    for (const entry of companyEntries) {
      const urls = await this.generateCompanyLinkedInUrls(entry.displayName);
      if (urls.length === 0) continue;

      if (entry.isCurrent) {
        urls.forEach(url => currentCompanyUrls.add(url));
      }
      if (entry.isPast) {
        urls.forEach(url => pastCompanyUrls.add(url));
      }
    }

    return {
      currentCompanies: Array.from(currentCompanyUrls).slice(0, RESUME_FILTER_LIMIT),
      pastCompanies: Array.from(pastCompanyUrls).slice(0, RESUME_FILTER_LIMIT),
      currentJobTitles: Array.from(currentJobTitles).slice(0, RESUME_FILTER_LIMIT),
      pastJobTitles: Array.from(pastJobTitles).slice(0, RESUME_FILTER_LIMIT),
    };
  }

  /**
   * Generate LinkedIn company URLs by creating slug variations and validating them
   */
  private async generateCompanyLinkedInUrls(company: string): Promise<string[]> {
    const slugCandidates = this.generateCompanySlugCandidates(company);
    if (slugCandidates.length === 0) {
      return [];
    }

    const urlCandidates = Array.from(new Set(slugCandidates.map(slug => `https://www.linkedin.com/company/${slug}/`))).slice(0, 12);
    const validUrls: string[] = [];
    const uncertainUrls: string[] = [];

    for (const url of urlCandidates) {
      const headResult = await this.fetchLinkedInStatus(url, 'HEAD');
      let decision = this.evaluateLinkedInStatus(url, headResult.status);

      if (decision === null) {
        const getResult = await this.fetchLinkedInStatus(url, 'GET', true);
        decision = this.evaluateLinkedInGetResult(url, getResult.status, getResult.body);
      }

      if (decision === true) {
        console.log(`✅ Confirmed valid: ${url} (status: ${headResult.status})`);
        validUrls.push(url);
      } else if (decision === null) {
        // LinkedIn anti-bot protection (999 or similar) - can't determine, so keep as fallback
        console.log(`⚠️ Uncertain (soft-blocked): ${url} (status: ${headResult.status})`);
        uncertainUrls.push(url);
      } else {
        console.log(`❌ Not found: ${url} (status: ${headResult.status})`);
      }

      // Stop early if we found some confirmed valid URLs
      if (validUrls.length >= 3) {
        break;
      }
    }

    // Return ONLY ONE URL - the most likely valid one
    // Priority: confirmed valid > uncertain fallback
    let finalUrl: string | null = null;
    
    if (validUrls.length > 0) {
      finalUrl = validUrls[0]; // Use the first confirmed valid URL
    } else if (uncertainUrls.length > 0) {
      finalUrl = uncertainUrls[0]; // Fallback to first uncertain URL
    }

    if (finalUrl) {
      console.log(`Generated 1 LinkedIn company URL for "${company}": ${finalUrl}`);
      return [finalUrl];
    }
    
    console.log(`No valid LinkedIn company URL found for "${company}"`);
    return [];
  }

  /**
   * Generate slug variations for a company name
   */
  private generateCompanySlugCandidates(company: string): string[] {
    const normalized = company.toLowerCase().replace(/&/g, ' and ');
    const cleanedTokens = normalized.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

    if (cleanedTokens.length === 0) {
      return [];
    }

    const basePhrase = cleanedTokens.join(' ');
    const phraseVariants = this.expandCompanyPhraseVariants(basePhrase);
    const seenSlugs = new Set<string>();
    const slugs: string[] = [];

    const addSlug = (slug: string) => {
      const trimmed = slug.replace(/^-+|-+$/g, '');
      if (!trimmed || seenSlugs.has(trimmed)) {
        return;
      }
      seenSlugs.add(trimmed);
      slugs.push(trimmed);
    };

    for (const phrase of phraseVariants) {
      const tokens = phrase.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) {
        continue;
      }

      addSlug(tokens.join(''));
      if (tokens.length > 1) {
        addSlug(tokens.join('-'));
      }

      const filteredTokens = tokens.filter(token => !LINKEDIN_COMPANY_FILLER_TOKENS.has(token));
      if (filteredTokens.length > 0 && filteredTokens.length !== tokens.length) {
        addSlug(filteredTokens.join(''));
        if (filteredTokens.length > 1) {
          addSlug(filteredTokens.join('-'));
        }
      }
    }

    // Ensure some deterministic ordering: prioritize shorter slugs first
    slugs.sort((a, b) => a.length - b.length || a.localeCompare(b));
    return slugs.slice(0, 20);
  }

  /**
   * Expand company phrase variants using known synonyms
   */
  private expandCompanyPhraseVariants(basePhrase: string): string[] {
    const variants = new Set<string>([basePhrase]);
    const queue: string[] = [basePhrase];

    while (queue.length > 0 && variants.size < 40) {
      const current = queue.shift()!;

      for (const [from, to] of LINKEDIN_COMPANY_SYNONYM_PAIRS) {
        const regex = new RegExp(`\\b${from}\\b`, 'g');
        const replaced = current.replace(regex, to);
        if (replaced !== current && !variants.has(replaced)) {
          variants.add(replaced);
          queue.push(replaced);
        }
      }
    }

    return Array.from(variants);
  }

  /**
   * Check if a LinkedIn company URL exists by performing lightweight HTTP requests
   */
  private async checkLinkedInCompanyUrlExists(url: string): Promise<boolean> {
    if (this.companyUrlValidationCache.has(url)) {
      return this.companyUrlValidationCache.get(url)!;
    }

    console.log(`🔍 Checking LinkedIn company URL: ${url}`);

    const headResult = await this.fetchLinkedInStatus(url, 'HEAD');
    let statusUsed = headResult.status;
    let decision = this.evaluateLinkedInStatus(url, headResult.status);

    if (decision === null) {
      const getResult = await this.fetchLinkedInStatus(url, 'GET', true);
      statusUsed = getResult.status;
      decision = this.evaluateLinkedInGetResult(url, getResult.status, getResult.body);
    }

    // ⚠️ LinkedIn anti-bot protection: if we still can't determine (999 or other soft blocks),
    // we ASSUME the URL is valid since we can't reliably check it
    // This prevents false negatives when LinkedIn blocks our validation attempts
    const exists = decision ?? true; // Changed from false to true

    this.companyUrlValidationCache.set(url, exists);

    console.log(`🔎 LinkedIn company URL check result (${statusUsed ?? 'no-response'}): ${url} -> ${exists ? 'exists' : 'not found'}`);
    return exists;
  }

  private evaluateLinkedInStatus(url: string, status: number | null): boolean | null {
    if (status === null) {
      return null;
    }
    if (status >= 200 && status < 400) {
      return true;
    }
    if (status === 404) {
      return false;
    }
    if ([403, 429].includes(status)) {
      return true;
    }
    // For statuses like 999 or other unexpected codes, return null to trigger GET analysis
    return null;
  }

  private evaluateLinkedInGetResult(url: string, status: number | null, body?: string): boolean | null {
    const statusDecision = this.evaluateLinkedInStatus(url, status);
    if (statusDecision !== null) {
      return statusDecision;
    }

    const lowerBody = (body || '').toLowerCase();
    if (lowerBody) {
      if (LINKEDIN_NOT_FOUND_PATTERNS.some(pattern => lowerBody.includes(pattern))) {
        return false;
      }

      const canonicalSlug = this.extractCanonicalCompanySlug(lowerBody);
      const originalSlug = this.extractSlugFromCompanyUrl(url);

      if (canonicalSlug) {
        if (originalSlug && canonicalSlug === originalSlug) {
          return true;
        }
        return false;
      }
    }

    return null;
  }

  private extractSlugFromCompanyUrl(url: string): string {
    const parts = url.split('/company/');
    if (parts.length < 2) return '';
    return parts[1].replace(/\/+$/, '').toLowerCase();
  }

  private extractCanonicalCompanySlug(body: string): string | null {
    const canonicalMatch = body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.linkedin\.com\/company\/([^"']+)/i);
    if (!canonicalMatch) return null;
    return canonicalMatch[1].replace(/\/+$/, '').toLowerCase();
  }

  /**
   * Perform a lightweight HTTP request to LinkedIn and optionally return the body
   */
  private fetchLinkedInStatus(url: string, method: 'HEAD' | 'GET', collectBody = false): Promise<{ status: number | null; body?: string }> {
    return new Promise(resolve => {
      try {
        const req = request(url, {
          method,
          headers: {
            'User-Agent': this.linkedInUserAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
          },
        }, res => {
          const status = res.statusCode ?? null;
          if (!collectBody) {
            res.resume();
            resolve({ status });
            return;
          }

          let accumulated = '';
          res.on('data', chunk => {
            if (accumulated.length >= LINKEDIN_BODY_MAX_BYTES) {
              return;
            }
            accumulated += chunk.toString();
          });
          res.on('end', () => {
            if (accumulated.length > LINKEDIN_BODY_MAX_BYTES) {
              accumulated = accumulated.slice(0, LINKEDIN_BODY_MAX_BYTES);
            }
            resolve({ status, body: accumulated });
          });
        });

        req.setTimeout(this.linkedInRequestTimeoutMs, () => {
          req.destroy();
          resolve({ status: null });
        });

        req.on('error', () => resolve({ status: null }));
        req.end();
      } catch (error) {
        console.warn(`Failed to ${method} ${url}:`, error);
        resolve({ status: null });
      }
    });
  }

  /**
   * Determine whether the status code indicates a likely existing LinkedIn company page
   */
  private isLikelyLinkedInCompanyStatus(statusCode: number): boolean {
    if (!statusCode) {
      return false;
    }

    if (statusCode >= 200 && statusCode < 400) {
      return true;
    }

    return [403, 429, 999].includes(statusCode);
  }

  /**
   * Search LinkedIn profiles using Apify actors based on available data
   */
  async searchProfilesWithApify(
    name: string,
    title?: string,
    company?: string,
    location?: string,
    maxResults: number = 20,
    candidates?: any[]
  ): Promise<string | null> {
    try {
      console.log(`Searching LinkedIn profiles with Apify for: ${name} ${title ? `(${title})` : ''} ${company ? `at ${company}` : ''}`);
      
      if (!process.env.APIFY_API_TOKEN) {
        console.warn('APIFY_API_TOKEN not configured. Cannot use Apify search.');
        return null;
      }

      let preferredLinkedInUrl: string | null = null;

      // Check if any candidates have LinkedIn URLs - enrich with dev_fusion but continue with Apify search for logging/validation
      if (candidates && candidates.length > 0) {
        const candidateWithLinkedIn = candidates.find(c => c.linkedinUrl && c.linkedinUrl.includes('linkedin.com/in/'));
        if (candidateWithLinkedIn) {
          preferredLinkedInUrl = candidateWithLinkedIn.linkedinUrl;
          console.log(`Found candidate with LinkedIn URL: ${candidateWithLinkedIn.linkedinUrl}, enriching with dev_fusion actor before Apify search`);
          
          const devFusionData = await this.getProfileWithDevFusion(candidateWithLinkedIn.linkedinUrl);
          if (devFusionData) {
            // Save the dev_fusion results
            this.saveDevFusionResults(devFusionData, candidateWithLinkedIn.linkedinUrl);
            
            // Update database with the fetched LinkedIn data
            try {
              // Update candidate record - TODO: Update to use consolidated candidates table
              // await ResumeDataService.updateCandidateWithLinkedInData(
              //   candidateWithLinkedIn.id,
              //   devFusionData,
              //   'dev_fusion'
              // );

              // Update resume data if available - TODO: Update to use consolidated candidates table
              // if (candidateWithLinkedIn.resumeDataId) {
              //   await ResumeDataService.updateResumeDataWithLinkedIn(
              //     candidateWithLinkedIn.resumeDataId,
              //     devFusionData,
              //     'dev_fusion'
              //   );
              // }
            } catch (dbError) {
              console.warn('Failed to update database with LinkedIn data:', dbError);
            }
            
          } else {
            console.log('Dev_fusion actor failed, continuing with harvestapi search');
            preferredLinkedInUrl = null;
          }
        }
      }

      // Prepare search input for harvestapi
      // Use searchQuery for fuzzy search with full name
      const searchInput: ApifyLinkedInSearchInput = {
        searchQuery: name,               // Fuzzy search with full name
        profileScraperMode: "Full",
        maxItems: maxResults,
        startPage: 1
      };
      
      // Note: location parameter removed - causes 0 results from Apify
      // if (location) {
      //   searchInput.locations = [location];
      // }
      
      const currentCompanySet = new Set<string>();
      const pastCompanySet = new Set<string>();
      const currentJobTitleSet = new Set<string>();
      const pastJobTitleSet = new Set<string>();

      if (title) {
        currentJobTitleSet.add(title);
      }

      const resumeCurrentTitle = candidates?.map(candidate => candidate.currentTitle || candidate.title).find(Boolean);
      if (resumeCurrentTitle) {
        currentJobTitleSet.add(resumeCurrentTitle);
      }

      if (candidates && candidates.length > 0) {
        const companyUrls = this.extractCompanyLinkedInUrls(candidates);
        if (companyUrls.length > 0) {
          companyUrls.forEach(url => currentCompanySet.add(url));
          console.log(`Using ${companyUrls.length} company LinkedIn URLs from uploaded data`);
        }

        const resumeFilters = await this.extractLinkedInFiltersFromCandidates(candidates);

        if (resumeFilters.currentCompanies.length > 0) {
          resumeFilters.currentCompanies.forEach(url => currentCompanySet.add(url));
          console.log(`Added ${resumeFilters.currentCompanies.length} validated current company URLs from resume data`);
        }

        if (resumeFilters.pastCompanies.length > 0) {
          resumeFilters.pastCompanies.forEach(url => pastCompanySet.add(url));
          console.log(`Added ${resumeFilters.pastCompanies.length} validated past company URLs from resume data`);
        }

        if (resumeFilters.currentJobTitles.length > 0) {
          resumeFilters.currentJobTitles.forEach(job => currentJobTitleSet.add(job));
        }

        if (resumeFilters.pastJobTitles.length > 0) {
          resumeFilters.pastJobTitles.forEach(job => pastJobTitleSet.add(job));
        }
      }

      // Add company if provided (convert to LinkedIn company URL for better results)
      if (company) {
        const generatedCompanyUrls = await this.generateCompanyLinkedInUrls(company);
        if (generatedCompanyUrls.length > 0) {
          generatedCompanyUrls.forEach(url => currentCompanySet.add(url));
        }
      }

      if (preferredLinkedInUrl && currentCompanySet.size === 0 && company) {
        const fallbackCompanyUrls = await this.generateCompanyLinkedInUrls(company);
        fallbackCompanyUrls.forEach(url => currentCompanySet.add(url));
      }

      if (currentCompanySet.size > 0) {
        searchInput.currentCompanies = Array.from(currentCompanySet).slice(0, RESUME_FILTER_LIMIT);
      }

      if (pastCompanySet.size > 0) {
        searchInput.pastCompanies = Array.from(pastCompanySet).slice(0, RESUME_FILTER_LIMIT);
      }

      if (currentJobTitleSet.size > 0) {
        searchInput.currentJobTitles = Array.from(currentJobTitleSet).slice(0, RESUME_FILTER_LIMIT);
      }

      if (pastJobTitleSet.size > 0) {
        searchInput.pastJobTitles = Array.from(pastJobTitleSet).slice(0, RESUME_FILTER_LIMIT);
      }

      if ((searchInput.currentCompanies?.length || searchInput.pastCompanies?.length) && searchInput.recentlyChangedJobs === undefined) {
        searchInput.recentlyChangedJobs = false;
      }

      console.log('📎 Apify filters summary:', {
        currentCompanies: searchInput.currentCompanies,
        pastCompanies: searchInput.pastCompanies,
        currentJobTitles: searchInput.currentJobTitles,
        pastJobTitles: searchInput.pastJobTitles
      });

      console.log('📤 Apify actor input payload:\n' + JSON.stringify(searchInput, null, 2));

      // Run the harvestapi Apify actor using actor ID
      // .call() automatically waits for the actor to finish and returns the run object
      console.log('⏳ Running Apify actor (this may take 20-30 seconds)...');
      const run = await this.apifyClient.actor("M2FMdjRVeF1HPGFcc").call(searchInput);
      console.log(`✅ Actor finished! (Run ID: ${run.id})`);
      
      // Fetch results
      const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
      
      console.log(`📊 Apify returned ${items?.length || 0} results`);
      
      // Save the raw harvestapi results
      const searchQuery = `${name} ${title || ''} ${company || ''} ${location || ''}`.trim();
      this.saveHarvestApiResults(items, searchQuery);
      
      if (!items || items.length === 0) {
        console.log('❌ No LinkedIn profiles found with Apify search');
        console.log('💡 Tip: Try with fewer search criteria or check if the profile exists on LinkedIn');
        return preferredLinkedInUrl;
      }

      console.log(`✅ Found ${items.length} LinkedIn profiles with Apify search`);
      
      // If we have results, use the first one (no scoring needed)
      if (items.length > 0) {
        const firstResult = items[0];
        console.log('Using first result from Apify search:', {
          name: firstResult.firstName + ' ' + firstResult.lastName,
          currentPosition: firstResult['currentPosition/0/companyName'],
          location: firstResult['location/linkedinText'],
          linkedinUrl: firstResult.linkedinUrl
        });
        
        const linkedinUrl = typeof firstResult.linkedinUrl === 'string' ? firstResult.linkedinUrl : null;
        
        // ✅ CACHE the profile data to avoid duplicate API call during enrichment
        if (linkedinUrl) {
          this.lastSearchResults.set(linkedinUrl, firstResult);
          console.log(`✅ Cached profile data for ${linkedinUrl} (avoiding duplicate API call)`);
        }
        
        return preferredLinkedInUrl || linkedinUrl;
      }

      console.log('No LinkedIn profiles found with Apify search');
      return preferredLinkedInUrl;

    } catch (error) {
      console.error('Apify LinkedIn search failed:', error);
      return null;
    }
  }

  /**
   * Search LinkedIn profiles and return both URL and profile data
   * This avoids duplicate API calls
   */
  async searchProfilesWithData(
    name: string, 
    company?: string, 
    title?: string, 
    location?: string, 
    candidates?: any[]
  ): Promise<{ 
    url: string; 
    profile: LinkedInProfile;
    validation?: {
      isValid: boolean;
      confidence: number;
      warnings: string[];
      errors: string[];
    }
  } | null> {
    try {
      // Use Apify search only - no URL generation fallback
      // Note: location parameter removed - causes 0 results from Apify
      const linkedinUrl = await this.searchProfilesWithApify(name, title, company, undefined, 20, candidates);
      
      if (!linkedinUrl) {
        console.log('No LinkedIn profiles found with Apify search');
        return null;
      }

      // Check if we have cached profile data from the search
      if (this.lastSearchResults.has(linkedinUrl)) {
        console.log(`✅ Using cached profile data from search (no additional API call needed)`);
        const cachedData = this.lastSearchResults.get(linkedinUrl);
        this.lastSearchResults.delete(linkedinUrl); // Clean up cache
        
        const profile = this.transformHarvestApiData(cachedData);
        profile.profileUrl = linkedinUrl;
        
        // ✅ NEW: Validate profile data quality
        const validation = this.validateProfileData(profile, name, company, title);
        
        // Log validation results
        if (!validation.isValid) {
          console.warn(`⚠️ Profile validation failed (${validation.confidence}% confidence):`, {
            errors: validation.errors,
            warnings: validation.warnings
          });
        } else if (validation.warnings.length > 0) {
          console.warn(`⚠️ Profile validation warnings (${validation.confidence}% confidence):`, validation.warnings);
        } else {
          console.log(`✅ Profile validation passed (${validation.confidence}% confidence)`);
        }
        
        return { 
          url: linkedinUrl, 
          profile,
          validation  // Include validation results
        };
      }

      // Fallback: if no cache, return null (shouldn't happen with current implementation)
      console.warn('⚠️ No cached data found, returning null');
      return null;
      
    } catch (error) {
      console.error('LinkedIn profile search failed:', error);
      return null;
    }
  }

  /**
   * Search LinkedIn profiles by name and company
   * Enhanced version that uses Apify search
   */
  async searchProfiles(name: string, company?: string, title?: string, location?: string, candidates?: any[]): Promise<string | null> {
    try {
      // Use Apify search only - no URL generation fallback
      // Note: location parameter removed - causes 0 results from Apify
      const apifyResult = await this.searchProfilesWithApify(name, title, company, undefined, 20, candidates);
      
      if (apifyResult) {
        return apifyResult;
      }

      // If no results found, return null instead of generating fake URLs
      console.log('No LinkedIn profiles found with Apify search');
      return null;
      
    } catch (error) {
      console.error('LinkedIn profile search failed:', error);
      return null;
    }
  }

  /**
   * Search LinkedIn profiles with scoring and return multiple results
   * This method now uses Apify search
   */
  async searchProfilesWithScoring(
    name: string, 
    title?: string, 
    company?: string, 
    location?: string,
    maxResults: number = 10,
    candidates?: any[]
  ): Promise<string | null> {
    try {
      console.log(`Searching LinkedIn profiles for: ${name} ${title ? `(${title})` : ''} ${company ? `at ${company}` : ''}`);
      
      // Use Apify search
      // Note: location parameter removed - causes 0 results from Apify
      const apifyResult = await this.searchProfilesWithApify(name, title, company, undefined, maxResults, candidates);
      
      if (apifyResult) {
        return apifyResult;
      }

      console.log('No LinkedIn search results found');
      return null;

    } catch (error) {
      console.error('LinkedIn profile search with scoring failed:', error);
      return null;
    }
  }

  // Removed findBestApifyMatch method - no longer needed since we use first result

  // Removed calculateSimpleNameMatch method - no longer needed

  /**
   * Calculate name matching score for Apify results
   */
  private calculateNameMatchScoreForApify(result: ApifyLinkedInSearchResult, targetName: string): number {
    const resultName = result.name;
    if (!resultName) return 0;

    const targetNormalized = targetName.toLowerCase().replace(/[^a-z\s]/g, '');
    const resultNormalized = resultName.toLowerCase().replace(/[^a-z\s]/g, '');

    // Exact match
    if (targetNormalized === resultNormalized) return 1.0;

    // Check if all words from target name are present in result name
    const targetWords = targetNormalized.split(/\s+/).filter(word => word.length > 1);
    const resultWords = resultNormalized.split(/\s+/).filter(word => word.length > 1);

    if (targetWords.length === 0) return 0;

    const matchingWords = targetWords.filter(word => 
      resultWords.some(resultWord => 
        resultWord.includes(word) || word.includes(resultWord)
      )
    );

    return matchingWords.length / targetWords.length;
  }

  /**
   * Calculate title matching score
   */
  private calculateTitleMatchScore(resultTitle: string, targetTitle: string): number {
    const resultNormalized = resultTitle.toLowerCase().replace(/[^a-z\s]/g, '');
    const targetNormalized = targetTitle.toLowerCase().replace(/[^a-z\s]/g, '');

    // Exact match
    if (resultNormalized === targetNormalized) return 1.0;

    // Check for key terms
    const targetWords = targetNormalized.split(/\s+/).filter(word => word.length > 2);
    const resultWords = resultNormalized.split(/\s+/).filter(word => word.length > 2);

    if (targetWords.length === 0) return 0;

    const matchingWords = targetWords.filter(word => 
      resultWords.some(resultWord => 
        resultWord.includes(word) || word.includes(resultWord)
      )
    );

    return matchingWords.length / targetWords.length;
  }

  /**
   * Calculate company matching score
   */
  private calculateCompanyMatchScore(resultCompany: string, targetCompany: string): number {
    const resultNormalized = resultCompany.toLowerCase().replace(/[^a-z\s]/g, '');
    const targetNormalized = targetCompany.toLowerCase().replace(/[^a-z\s]/g, '');

    // Exact match
    if (resultNormalized === targetNormalized) return 1.0;

    // Check for key terms
    const targetWords = targetNormalized.split(/\s+/).filter(word => word.length > 2);
    const resultWords = resultNormalized.split(/\s+/).filter(word => word.length > 2);

    if (targetWords.length === 0) return 0;

    const matchingWords = targetWords.filter(word => 
      resultWords.some(resultWord => 
        resultWord.includes(word) || word.includes(resultWord)
      )
    );

    return matchingWords.length / targetWords.length;
  }

  /**
   * Calculate location matching score
   */
  private calculateLocationMatchScore(resultLocation: string, targetLocation: string): number {
    const resultNormalized = resultLocation.toLowerCase().replace(/[^a-z\s]/g, '');
    const targetNormalized = targetLocation.toLowerCase().replace(/[^a-z\s]/g, '');

    // Exact match
    if (resultNormalized === targetNormalized) return 1.0;

    // Check for key terms
    const targetWords = targetNormalized.split(/\s+/).filter(word => word.length > 2);
    const resultWords = resultNormalized.split(/\s+/).filter(word => word.length > 2);

    if (targetWords.length === 0) return 0;

    const matchingWords = targetWords.filter(word => 
      resultWords.some(resultWord => 
        resultWord.includes(word) || word.includes(resultWord)
      )
    );

    return matchingWords.length / targetWords.length;
  }

  /**
   * Validate LinkedIn profile data quality against input parameters
   * Returns validation result with warnings/errors
   */
  private validateProfileData(
    profile: LinkedInProfile,
    inputName: string,
    inputCompany?: string,
    inputTitle?: string
  ): { 
    isValid: boolean; 
    confidence: number;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];
    let totalScore = 0;
    let checks = 0;

    // 1. Validate Name (CRITICAL)
    if (profile.name) {
      const nameScore = this.calculateNameMatchScoreForApify({ name: profile.name } as any, inputName);
      totalScore += nameScore;
      checks++;

      if (nameScore < 0.3) {
        errors.push(`Name mismatch: Expected "${inputName}", found "${profile.name}" (${Math.round(nameScore * 100)}% match)`);
      } else if (nameScore < 0.6) {
        warnings.push(`Partial name match: Expected "${inputName}", found "${profile.name}" (${Math.round(nameScore * 100)}% match)`);
      }
    } else {
      errors.push('Profile name is missing');
      checks++;
    }

    // 2. Validate Company (if provided)
    if (inputCompany && profile.currentCompany) {
      const companyScore = this.calculateCompanyMatchScore(profile.currentCompany, inputCompany);
      totalScore += companyScore;
      checks++;

      if (companyScore < 0.3) {
        warnings.push(`Company mismatch: Expected "${inputCompany}", found "${profile.currentCompany}" (${Math.round(companyScore * 100)}% match)`);
      } else if (companyScore < 0.6) {
        warnings.push(`Partial company match: Expected "${inputCompany}", found "${profile.currentCompany}" (${Math.round(companyScore * 100)}% match)`);
      }
    }

    // 3. Validate Title (if provided)
    if (inputTitle && profile.headline) {
      const titleScore = this.calculateTitleMatchScore(profile.headline, inputTitle);
      totalScore += titleScore;
      checks++;

      if (titleScore < 0.3) {
        warnings.push(`Title mismatch: Expected "${inputTitle}", found "${profile.headline}" (${Math.round(titleScore * 100)}% match)`);
      }
    }

    // 4. Check for essential profile data
    if (!profile.experience || profile.experience.length === 0) {
      warnings.push('No work experience found in profile');
    }

    if (!profile.skills || profile.skills.length === 0) {
      warnings.push('No skills found in profile');
    }

    // Calculate overall confidence
    const confidence = checks > 0 ? (totalScore / checks) : 0;

    // Determine if profile is valid
    // Profile is invalid if name match is too low (< 30%) or has critical errors
    const isValid = errors.length === 0 && confidence >= 0.3;

    return {
      isValid,
      confidence: Math.round(confidence * 100),
      warnings,
      errors
    };
  }

  /**
   * Calculate snippet relevance score (DEPRECATED)
   */
  private calculateSnippetRelevance(
    snippet: string, 
    targetName: string, 
    targetTitle?: string, 
    targetCompany?: string
  ): number {
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
  private extractNameFromTitle(title: string): string | null {
    // Simple extraction - look for patterns like "John Smith - Software Engineer"
    const nameMatch = title.match(/^([^-|–]+)/);
    return nameMatch ? nameMatch[1].trim() : null;
  }

  /**
   * Enrich candidate profile using LinkedIn search and scraping
   */
  async enrichProfile(linkedinUrl?: string, name?: string, company?: string, title?: string, location?: string, candidates?: any[]): Promise<LinkedInProfile | null> {
    let foundLinkedInUrl: string | null = null;
    
    try {
      let profileUrl = linkedinUrl;

      // If no LinkedIn URL provided or URL doesn't exist, search for it
      if (!profileUrl && name) {
        profileUrl = await this.searchProfiles(name, company, title, location, candidates) || undefined;
        if (profileUrl) {
          foundLinkedInUrl = profileUrl; // Store the found URL
          console.log(`Found LinkedIn URL through search: ${foundLinkedInUrl}`);
        }
      } else if (profileUrl) {
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
      
      // CORRECT LOGIC: Use DevFusion for direct profile scraping when LinkedIn URL exists
      if (profileUrl && profileUrl.includes('linkedin.com/in/')) {
        console.log('LinkedIn URL detected, using dev_fusion actor for direct profile scraping');
        try {
          const devFusionData = await this.getProfileWithDevFusion(profileUrl);
          if (devFusionData) {
            console.log('✅ DevFusion actor returned profile data');
            const enrichedProfile = this.transformDevFusionData(devFusionData);
            enrichedProfile.profileUrl = profileUrl;
            return enrichedProfile;
          } else {
            console.log('⚠️ DevFusion actor returned no data, falling back to harvestapi');
          }
        } catch (devFusionError) {
          console.error('❌ DevFusion actor failed:', devFusionError);
          console.log('⚠️ DevFusion failed, falling back to harvestapi');
        }
      }
      
      // Use harvestapi actor for LinkedIn profile search and scraping
      console.log('Using harvestapi actor for LinkedIn profile search and scraping');
      
      try {
        // ✅ CHECK CACHE FIRST - avoid duplicate API call if we already have the data
        if (foundLinkedInUrl && this.lastSearchResults.has(foundLinkedInUrl)) {
          console.log(`✅ Using cached profile data for ${foundLinkedInUrl} (skipping duplicate API call)`);
          const cachedData = this.lastSearchResults.get(foundLinkedInUrl);
          this.lastSearchResults.delete(foundLinkedInUrl); // Clean up cache after use
          
          const enrichedProfile = this.transformHarvestApiData(cachedData);
          enrichedProfile.profileUrl = foundLinkedInUrl;
          return enrichedProfile;
        }
        
        // Search again with the same parameters to get full profile data
        const searchInput: ApifyLinkedInSearchInput = {
          searchQuery: name,             // Use searchQuery for fuzzy search
          profileScraperMode: "Full",
          maxItems: 20,
          startPage: 1
        };
        
        // Note: location parameter removed - causes 0 results from Apify
        // if (location) {
        //   searchInput.locations = [location];
        // }
        
        // Add title only if provided
        if (title) {
          searchInput.currentJobTitles = [title];
        }

        // Extract company LinkedIn URLs from uploaded data
        if (candidates && candidates.length > 0) {
          const companyUrls = this.extractCompanyLinkedInUrls(candidates);
          if (companyUrls.length > 0) {
            searchInput.currentCompanies = companyUrls;
          }
        }

        // Add company if provided (convert to LinkedIn company URL for better results)
        if (company) {
          if (!searchInput.currentCompanies) searchInput.currentCompanies = [];
          const generatedCompanyUrls = await this.generateCompanyLinkedInUrls(company);
          if (generatedCompanyUrls.length > 0) {
            searchInput.currentCompanies.push(...generatedCompanyUrls);
            searchInput.currentCompanies = Array.from(new Set(searchInput.currentCompanies));
          }
        }

        console.log('Enrichment search input:', JSON.stringify(searchInput, null, 2));

        // Using the harvestapi LinkedIn Profile Search actor with actor ID
        // .call() automatically waits for the actor to finish and returns the run object
        console.log('⏳ Running Apify actor for enrichment (this may take 20-30 seconds)...');
        const run = await this.apifyClient.actor("M2FMdjRVeF1HPGFcc").call(searchInput);
        console.log(`✅ Enrichment actor finished! (Run ID: ${run.id})`);
        
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
            const matchingCandidate = candidates.find(c => 
              c.linkedinUrl === profileUrl || 
              c.linkedinUrl === foundLinkedInUrl ||
              c.name === enrichedProfile.name ||
              (c.title && c.title.toLowerCase().includes(enrichedProfile.title?.toLowerCase() || ''))
            );
            
            if (matchingCandidate) {
              // Update candidate record - TODO: Update to use consolidated candidates table
              // await ResumeDataService.updateCandidateWithLinkedInData(
              //   matchingCandidate.id,
              //   profileData,
              //   'harvestapi'
              // );

              // Update resume data if available - TODO: Update to use consolidated candidates table
              // if (matchingCandidate.resumeDataId) {
              //   await ResumeDataService.updateResumeDataWithLinkedIn(
              //     matchingCandidate.resumeDataId,
              //     profileData,
              //     'harvestapi'
              //   );
              // }
            }
          }
        } catch (dbError) {
          console.warn('Failed to update database with LinkedIn data:', dbError);
        }
        
        return enrichedProfile;
      } catch (apifyError: any) {
        // Handle specific Apify errors
        if (apifyError.statusCode === 403 && apifyError.type === 'insufficient-permissions') {
          throw new Error('Apify API access denied. Please check your subscription and API credentials.');
        } else if (apifyError.statusCode === 429) {
          throw new Error('Apify API rate limit exceeded. Please try again later.');
        } else if (apifyError.statusCode === 500) {
          throw new Error('Apify service temporarily unavailable. Please try again later.');
        } else {
          throw new Error(`Apify API error: ${apifyError.message || 'Unknown error occurred'}`);
        }
      }
      
    } catch (error) {
      console.error('LinkedIn profile enrichment failed:', error);
      throw error; // Re-throw the error instead of falling back to mock data
    }
  }

  /**
   * Transform dev_fusion LinkedIn profile data to our LinkedIn profile format
   */
  private transformDevFusionData(data: any): LinkedInProfile {
    console.log('🔍 Raw dev_fusion data structure:');
    console.log('Keys:', Object.keys(data));
    
    // Handle edge cases: null, undefined, or invalid data
    if (!data || typeof data !== 'object') {
      console.warn('⚠️ Invalid dev_fusion data received');
      return this.createBasicProfile('', '', '', '');
    }
    
    // Handle the nested structure from dev_fusion actor
    let profileData = data;
    if (data.rawData && typeof data.rawData === 'object') {
      profileData = data.rawData;
      console.log('📁 Found rawData, using nested structure');
    }
    
    console.log('Profile data keys:', Object.keys(profileData));
    console.log('🔍 Full profile data structure:', JSON.stringify(profileData, null, 2));
    
    // Extract experience data from the Apify format
    const experiences: Array<{
      title: string;
      company: string;
      duration: string;
      description: string;
    }> = [];
    
    if (profileData.experiences && Array.isArray(profileData.experiences)) {
      profileData.experiences.forEach((exp: any, index: number) => {
        try {
          if (!exp || typeof exp !== 'object') {
            console.warn(`⚠️ Invalid experience object at index ${index}`);
            return;
          }
          
          // Extract company from subtitle (e.g., "Aimplify · Full-time" -> "Aimplify")
          let companyName = 'Unknown';
          if (exp.subtitle && typeof exp.subtitle === 'string') {
            companyName = exp.subtitle.split('·')[0].trim();
            console.log(`🔍 Extracted company from subtitle: "${exp.subtitle}" -> "${companyName}"`);
          } else if (exp.company && typeof exp.company === 'string') {
            companyName = exp.company;
          } else if (exp.companyName && typeof exp.companyName === 'string') {
            companyName = exp.companyName;
          }
          
          experiences.push({
            title: exp.title || exp.position || exp.jobTitle || 'Unknown',
            company: companyName,
            duration: exp.duration || exp.timePeriod || exp.currentJobDuration || 'Unknown',
            description: exp.description || ''
          });
        } catch (expError) {
          console.error(`❌ Error processing experience at index ${index}:`, expError);
        }
      });
    }

    // Extract education data from Apify format
    const education: Array<{
      school: string;
      degree: string;
      field: string;
      years: string;
    }> = [];
    
    if (profileData.educations && Array.isArray(profileData.educations)) {
      profileData.educations.forEach((edu: any) => {
        try {
          if (edu && typeof edu === 'object') {
            education.push({
              school: edu.title || edu.school || edu.institution || 'Unknown',
              degree: edu.subtitle || edu.degree || 'Unknown',
              field: edu.field || edu.major || 'Unknown',
              years: edu.caption || edu.years || edu.timePeriod || 'Unknown'
            });
          }
        } catch (eduError) {
          console.error('❌ Error processing education:', eduError);
        }
      });
    }

    // Extract skills from Apify format
    const skills: string[] = [];
    if (profileData.skills && Array.isArray(profileData.skills)) {
      profileData.skills.forEach((skill: any) => {
        try {
          if (skill && typeof skill === 'object' && skill.title) {
            skills.push(skill.title);
          } else if (typeof skill === 'string') {
            skills.push(skill);
          }
        } catch (skillError) {
          console.error('❌ Error processing skill:', skillError);
        }
      });
    }
    
    // Extract certifications from Apify format
    const certifications: Array<{
      name: string;
      issuer: string;
      date: string;
    }> = [];
    
    if (profileData.licenseAndCertificates && Array.isArray(profileData.licenseAndCertificates)) {
      profileData.licenseAndCertificates.forEach((cert: any) => {
        try {
          if (cert && typeof cert === 'object') {
            certifications.push({
              name: cert.title || cert.name || 'Unknown',
              issuer: cert.issuer || cert.organization || 'Unknown',
              date: cert.date || cert.issuedDate || 'Unknown'
            });
          }
        } catch (certError) {
          console.error('❌ Error processing certification:', certError);
        }
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
        } else if (rawMostRecent.company) {
          currentCompany = rawMostRecent.company;
          console.log(`✅ Using raw company fallback: ${currentPosition} at ${currentCompany}`);
        } else if (rawMostRecent.companyName) {
          currentCompany = rawMostRecent.companyName;
          console.log(`✅ Using raw companyName fallback: ${currentPosition} at ${currentCompany}`);
        } else if (rawMostRecent.companyLink1) {
          // Extract company name from LinkedIn company URL
          const companyUrl = rawMostRecent.companyLink1;
          const companyName = companyUrl.split('/company/')[1]?.split('/')[0] || 'Unknown';
          currentCompany = companyName;
          console.log(`✅ Using companyLink1 fallback: ${currentPosition} at ${currentCompany}`);
        } else if (rawMostRecent.title && rawMostRecent.title.includes('(') && rawMostRecent.title.includes(')')) {
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
    } else if (profileData.company) {
      currentCompany = profileData.company;
      console.log(`✅ Using profileData.company: ${currentCompany}`);
    } else if (profileData.currentCompany) {
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
      } else if (rawMostRecent.company) {
        currentCompany = rawMostRecent.company;
        console.log(`✅ Final company fallback: ${currentPosition} at ${currentCompany}`);
      } else if (rawMostRecent.companyName) {
        currentCompany = rawMostRecent.companyName;
        console.log(`✅ Final companyName fallback: ${currentPosition} at ${currentCompany}`);
      } else if (rawMostRecent.companyLink1) {
        const companyUrl = rawMostRecent.companyLink1;
        const companyName = companyUrl.split('/company/')[1]?.split('/')[0] || 'Unknown';
        currentCompany = companyName;
        console.log(`✅ Final companyLink1 fallback: ${currentPosition} at ${currentCompany}`);
      } else if (rawMostRecent.title && rawMostRecent.title.includes('(') && rawMostRecent.title.includes(')')) {
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

    // Handle edge cases for all fields
    const safeSkills = Array.isArray(skills) ? skills.filter(skill => skill && typeof skill === 'string') : [];
    const safeExperiences = experiences.filter(exp => exp && exp.title && exp.company);
    const safeEducation = education.filter(edu => edu && edu.school && edu.degree);
    const safeCertifications = certifications.filter(cert => cert && cert.name);
    const safeLanguages = Array.isArray(profileData.languages) ? profileData.languages.filter((lang: any) => lang && typeof lang === 'string') : [];
    const safeRecentActivity = Array.isArray(profileData.recentActivity) ? profileData.recentActivity : [];
    const safePosts = Array.isArray(profileData.posts) ? profileData.posts : Array.isArray(profileData.updates) ? profileData.updates : [];

    return {
      name: profileData.fullName || profileData.name || 'Unknown',
      title: currentPosition || profileData.headline || 'Unknown',
      company: currentCompany || profileData.companyName || 'Unknown',
      skills: safeSkills,
      openToWork: Boolean(profileData.openToWork),
      lastActive: profileData.lastActive || profileData.lastSeen || 'Unknown',
      profileUrl: profileData.linkedinUrl || profileData.profileUrl || '',
      jobHistory: safeExperiences.map(exp => ({
        role: exp.title || 'Unknown',
        company: exp.company || 'Unknown',
        duration: exp.duration || 'Unknown'
      })),
      recentActivity: safeRecentActivity,
      headline: profileData.headline || profileData.title || '',
      location: profileData.addressWithCountry || profileData.location || '',
      summary: profileData.about || profileData.summary || '',
      experience: safeExperiences,
      education: safeEducation,
      connections: Number(profileData.connections || 0),
      profilePicture: profileData.profilePic || profileData.profilePicture || '',
      currentCompany: currentCompany || profileData.companyName || 'Unknown',
      currentPosition: currentPosition || profileData.headline || 'Unknown',
      industry: profileData.companyIndustry || profileData.industry || '',
      languages: safeLanguages,
      certifications: safeCertifications,
      posts: safePosts
    };
  }

  /**
   * Transform harvestapi LinkedIn search response data to our LinkedIn profile format
   */
  private transformHarvestApiData(data: any): LinkedInProfile {
    console.log('Transforming harvestapi data:', JSON.stringify(data, null, 2));
    
    // Extract experience data from the harvestapi format
    const experiences: Array<{
      title: string;
      company: string;
      duration: string;
      description: string;
    }> = [];
    if (data.experience && Array.isArray(data.experience)) {
      data.experience.forEach((exp: any) => {
        experiences.push({
          title: exp.position || 'Unknown Role',
          company: exp.companyName || 'Unknown Company',
          duration: exp.duration || 'Unknown Duration',
          description: exp.description || '',
        });
      });
    }

    // Extract education data
    const education: Array<{
      school: string;
      degree: string;
      field: string;
      years: string;
    }> = [];
    if (data.education && Array.isArray(data.education)) {
      data.education.forEach((edu: any) => {
        education.push({
          school: edu.schoolName || 'Unknown School',
          degree: edu.degree || 'Unknown Degree',
          field: edu.fieldOfStudy || 'Unknown Field',
          years: edu.period || 'Unknown Period',
        });
      });
    }

    // Extract skills
    const skills: string[] = [];
    if (data.skills && Array.isArray(data.skills)) {
      data.skills.forEach((skill: any) => {
        if (skill.name) {
          skills.push(skill.name);
        }
      });
    }

    // Extract certifications
    const certifications: Array<{
      name: string;
      issuer: string;
      date: string;
    }> = [];
    if (data.certifications && Array.isArray(data.certifications)) {
      data.certifications.forEach((cert: any) => {
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
    } else if (experiences.length > 0) {
      // Fallback to first experience if currentPosition is not available
      currentPosition = experiences[0].company;
      currentRole = experiences[0].title;
    }

    // Get location from the location object
    let location = 'Unknown Location';
    if (data.location) {
      if (typeof data.location === 'string') {
        location = data.location;
      } else if (data.location.linkedinText) {
        location = data.location.linkedinText;
      } else if (data.location.parsed && data.location.parsed.text) {
        location = data.location.parsed.text;
      }
    }

    // Parse connections count
    let connections = undefined;
    if (data.connectionsCount) {
      const connectionsStr = data.connectionsCount.toString();
      if (connectionsStr.includes('+')) {
        connections = parseInt(connectionsStr.replace('+', ''));
      } else {
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
  private transformApifyData(data: any): LinkedInProfile {
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
      jobHistory: positions.slice(0, 3).map((pos: any) => ({
        role: pos.title || 'Unknown Role',
        company: pos.companyName || 'Unknown Company',
        duration: pos.date || 'Unknown Duration',
      })),
      recentActivity: data.posts?.slice(0, 3).map((post: any) => post.text) || [],
      
      // Additional detailed fields
      headline: data.headline || data.title,
      location: data.location,
      summary: data.summary || data.about,
      experience: positions.map((pos: any) => ({
        title: pos.title,
        company: pos.companyName,
        duration: pos.date,
        description: pos.description,
      })),
      education: data.schools?.map((edu: any) => ({
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
      certifications: data.certifications?.map((cert: any) => ({
        name: cert.name,
        issuer: cert.issuer,
        date: cert.date,
      })) || [],
      posts: data.posts?.slice(0, 5).map((post: any) => ({
        text: post.text,
        date: post.date,
        engagement: post.totalReactionCount || 0,
      })) || [],
    };
  }

  /**
   * Create a basic LinkedIn profile when no data is found
   */
  private createBasicProfile(name?: string, company?: string, title?: string, location?: string, linkedinUrl?: string): LinkedInProfile {
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
  private analyzeOpenToWork(data: any): boolean {
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
      data.experience.forEach((exp: any) => {
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
  async batchEnrichProfiles(urls: string[]): Promise<Array<{ url: string; profile: LinkedInProfile | null; error?: string }>> {
    const results = [];
    
    for (const url of urls) {
      try {
        const profile = await this.enrichProfile(url);
        results.push({ url, profile });
        
        // Rate limiting - wait 2 seconds between requests to avoid blocking
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
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
  analyzeProfileSignals(profile: LinkedInProfile): {
    openToWorkSignals: number;
    engagementScore: number;
    stabilityScore: number;
    skillRelevance: number;
    insights: string[];
  } {
    const insights: string[] = [];
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
      const recentActivity = profile.posts.some(post => 
        new Date(post.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
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
  private parseDuration(duration: string): number {
    if (!duration) return 0;
    
    const yearMatch = duration.match(/(\d+)\s*(?:year|yr)/i);
    const monthMatch = duration.match(/(\d+)\s*(?:month|mo)/i);
    
    let years = yearMatch ? parseInt(yearMatch[1]) : 0;
    const months = monthMatch ? parseInt(monthMatch[1]) : 0;
    
    years += months / 12;
    
    return years;
  }
}

export const linkedInService = new LinkedInService();