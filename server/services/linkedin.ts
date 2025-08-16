import { ApifyClient } from 'apify-client';

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

export class LinkedInService {
  private apifyClient: ApifyClient;

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
   * Search LinkedIn profiles by name and company
   * Enhanced version that uses the search API with scoring
   */
  async searchProfiles(name: string, company?: string, title?: string, location?: string): Promise<string | null> {
    try {
      // Try the enhanced search with scoring first
      const enhancedResult = await this.searchProfilesWithScoring(name, title, company, location);
      
      if (enhancedResult) {
        return enhancedResult;
      }

      // Fallback to the old method if enhanced search fails
      console.log('Enhanced search failed, falling back to basic URL generation');
      
      if (!process.env.APIFY_API_TOKEN) {
        console.log('Using mock LinkedIn search for development');
        return `https://www.linkedin.com/in/${name.toLowerCase().replace(/\s+/g, '-')}/`;
      }

      // Generate a likely LinkedIn URL based on the name
      console.log(`Generating LinkedIn URL for: ${name} ${company ? `at ${company}` : ''}`);
      
      // Create a URL-friendly version of the name
      const urlFriendlyName = name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      
      const generatedUrl = `https://www.linkedin.com/in/${urlFriendlyName}/`;
      
      console.log(`Generated LinkedIn URL: ${generatedUrl}`);
      
      return generatedUrl;
      
    } catch (error) {
      console.error('LinkedIn profile search failed:', error);
      return null;
    }
  }

  /**
   * Search LinkedIn profiles with scoring and return multiple results
   * This method will call the search endpoint and select the best match
   */
  async searchProfilesWithScoring(
    name: string, 
    title?: string, 
    company?: string, 
    location?: string,
    maxResults: number = 10
  ): Promise<string | null> {
    try {
      console.log(`Searching LinkedIn profiles for: ${name} ${title ? `(${title})` : ''} ${company ? `at ${company}` : ''}`);
      
      // Call the search endpoint
      const searchResponse = await this.callLinkedInSearchAPI(name, title, company, location, maxResults);
      
      if (!searchResponse || !searchResponse.results || searchResponse.results.length === 0) {
        console.log('No LinkedIn search results found');
        return null;
      }

      console.log(`Found ${searchResponse.results.length} LinkedIn profiles for ${name}`);
      
      // Select the best match based on scoring
      const bestMatch = this.selectBestMatch(searchResponse.results, name, title, company, location);
      
      if (bestMatch) {
        console.log(`Selected best match: ${bestMatch.url} (score: ${bestMatch.score})`);
        return bestMatch.url;
      }

      console.log('No suitable match found among search results');
      return null;

    } catch (error) {
      console.error('LinkedIn profile search with scoring failed:', error);
      return null;
    }
  }

  /**
   * Call the LinkedIn search API endpoint
   */
  private async callLinkedInSearchAPI(
    name: string,
    title?: string,
    company?: string,
    location?: string,
    maxResults: number = 10
  ): Promise<LinkedInSearchResponse | null> {
    try {
      const searchUrl = 'http://localhost:8000/search';
      
      const searchPayload = {
        name: name,
        title: title,
        company: company,
        location: location,
        max_results: maxResults
      };

      console.log(`Calling LinkedIn search API: ${searchUrl}`);
      console.log('Search payload:', JSON.stringify(searchPayload, null, 2));

      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload),
      });

      if (!response.ok) {
        throw new Error(`Search API responded with status: ${response.status}`);
      }

      const searchResponse: LinkedInSearchResponse = await response.json();
      console.log(`Search API response: ${searchResponse.total_results} results in ${searchResponse.search_time}ms`);
      
      return searchResponse;

    } catch (error) {
      console.error('LinkedIn search API call failed:', error);
      return null;
    }
  }

  /**
   * Select the best match from search results based on maximum score
   */
  private selectBestMatch(
    results: LinkedInSearchResult[],
    targetName: string,
    targetTitle?: string,
    targetCompany?: string,
    targetLocation?: string
  ): LinkedInSearchResult | null {
    if (results.length === 0) return null;

    // If only one result, return it if score is reasonable
    if (results.length === 1) {
      return results[0].score >= 5.0 ? results[0] : null;
    }

    // Sort by base API score (descending) - use maximum score result
    const sortedResults = [...results].sort((a, b) => b.score - a.score);
    
    console.log('Base API scoring results:');
    sortedResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.url} - Score: ${result.score.toFixed(2)}`);
    });

    const maxScore = sortedResults[0].score;
    
    // Find all results with the maximum score
    const maxScoreResults = sortedResults.filter(result => result.score === maxScore);
    
    console.log(`Found ${maxScoreResults.length} results with maximum score: ${maxScore.toFixed(2)}`);
    
    // If only one result has the maximum score, return it
    if (maxScoreResults.length === 1) {
      console.log(`Selected result with maximum score: ${maxScore.toFixed(2)}`);
      return maxScoreResults[0];
    }
    
    // If multiple results have the same maximum score, apply field matching
    console.log('Multiple results with same score, applying field matching...');
    
    const fieldMatchedResults = maxScoreResults.map(result => {
      let matchScore = 0;
      let matchFactors: string[] = [];

      // Name matching
      const nameMatchScore = this.calculateNameMatchScore(result, targetName);
      matchScore += nameMatchScore;
      if (nameMatchScore > 0.8) matchFactors.push('exact_name');

      // Title matching
      if (targetTitle && result.title) {
        const titleMatchScore = this.calculateTitleMatchScore(result.title, targetTitle);
        matchScore += titleMatchScore;
        if (titleMatchScore > 0.7) matchFactors.push('title_match');
      }

      // Company matching
      if (targetCompany && result.company) {
        const companyMatchScore = this.calculateCompanyMatchScore(result.company, targetCompany);
        matchScore += companyMatchScore;
        if (companyMatchScore > 0.8) matchFactors.push('company_match');
      }

      // Location matching
      if (targetLocation && result.location) {
        const locationMatchScore = this.calculateLocationMatchScore(result.location, targetLocation);
        matchScore += locationMatchScore;
        if (locationMatchScore > 0.8) matchFactors.push('location_match');
      }

      // Snippet relevance
      const snippetScore = this.calculateSnippetRelevance(result.snippet, targetName, targetTitle, targetCompany);
      matchScore += snippetScore;

      return {
        ...result,
        fieldMatchScore: matchScore,
        matchFactors
      };
    });

    // Sort by field match score (descending)
    fieldMatchedResults.sort((a, b) => b.fieldMatchScore - a.fieldMatchScore);

    console.log('Field matching results for same-score candidates:');
    fieldMatchedResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.url} - Field Score: ${result.fieldMatchScore.toFixed(2)} (${result.matchFactors.join(', ')})`);
    });

    // Return the best match based on field matching
    const bestMatch = fieldMatchedResults[0];
    console.log(`Selected best match with field score: ${bestMatch.fieldMatchScore.toFixed(2)}`);
    return bestMatch;
  }

  /**
   * Calculate name matching score
   */
  private calculateNameMatchScore(result: LinkedInSearchResult, targetName: string): number {
    const resultName = result.name || this.extractNameFromTitle(result.title);
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
   * Calculate snippet relevance score
   */
  private calculateSnippetRelevance(
    snippet: string, 
    targetName: string, 
    targetTitle?: string, 
    targetCompany?: string
  ): number {
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
  async enrichProfile(linkedinUrl?: string, name?: string, company?: string, title?: string, location?: string): Promise<LinkedInProfile | null> {
    let normalizedUrl: string | null = null;
    let foundLinkedInUrl: string | null = null;
    
    try {
      let profileUrl = linkedinUrl;

      // If no LinkedIn URL provided or URL doesn't exist, search for it
      if (!profileUrl && name) {
        profileUrl = await this.searchProfiles(name, company, title, location) || undefined;
        if (profileUrl) {
          foundLinkedInUrl = profileUrl; // Store the found URL
          console.log(`Found LinkedIn URL through search: ${foundLinkedInUrl}`);
        }
      } else if (profileUrl) {
        foundLinkedInUrl = profileUrl; // Use the provided URL
      }

      if (!profileUrl) {
        throw new Error(`No LinkedIn profile found for ${name}`);
      }

      normalizedUrl = this.normalizeLinkedInUrl(profileUrl);
      if (!normalizedUrl) {
        throw new Error(`Invalid LinkedIn URL format: ${profileUrl}`);
      }

      // Check if APIFY_API_TOKEN is configured
      if (!process.env.APIFY_API_TOKEN) {
        throw new Error('APIFY_API_TOKEN not configured. LinkedIn enrichment requires valid API credentials.');
      }

      // Use dev_fusion's LinkedIn Profile Scraper (no cookies required)
      const input = {
        profileUrls: [normalizedUrl],
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL'],
        },
        maxProfilesToScrape: 1,
        includeContactInfo: true,
      };

      console.log(`Enriching LinkedIn profile: ${normalizedUrl}`);
      
      try {
        // Using the accessible LinkedIn actor
        const run = await this.apifyClient.actor('dev_fusion/Linkedin-Profile-Scraper').call(input);
        const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
        
        if (!items || items.length === 0) {
          throw new Error(`No profile data found for URL: ${normalizedUrl}`);
        }

        const profileData = items[0];
        const enrichedProfile = this.transformApifyData(profileData);
        
        // Ensure the found LinkedIn URL is set in the enriched profile
        if (foundLinkedInUrl) {
          enrichedProfile.profileUrl = foundLinkedInUrl;
          console.log(`Set LinkedIn URL in enriched profile: ${foundLinkedInUrl}`);
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
   * Transform Apify response data to our LinkedIn profile format
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
      openToWork: data.openToWork || this.analyzeOpenToWork(data),
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

    const profile = `${data.headline || ''} ${data.summary || ''} ${data.about || ''}`.toLowerCase();
    const posts = (data.posts || []).map((post: any) => post.text || '').join(' ').toLowerCase();
    const fullText = `${profile} ${posts}`;

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