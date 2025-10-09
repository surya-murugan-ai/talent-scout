import OpenAI from "openai";
export class OptimizedOpenAI {
    static instance;
    openai;
    requestQueue = [];
    isProcessing = false;
    rateLimitDelay = 100; // ms between requests
    maxConcurrentRequests = 3;
    activeRequests = 0;
    cache = new Map();
    cacheExpiry = 5 * 60 * 1000; // 5 minutes
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || ""
        });
    }
    static getInstance() {
        if (!OptimizedOpenAI.instance) {
            OptimizedOpenAI.instance = new OptimizedOpenAI();
        }
        return OptimizedOpenAI.instance;
    }
    /**
     * Analyze candidate with rate limiting and caching
     */
    async analyzeCandidate(candidateData, jobDescription = "", weights) {
        const cacheKey = this.generateAnalysisCacheKey(candidateData, weights);
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                console.log(`Using cached analysis for ${candidateData.name}`);
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }
        // Add to request queue for rate limiting
        return new Promise((resolve, reject) => {
            this.requestQueue.push(async () => {
                try {
                    const result = await this.performAnalysis(candidateData, jobDescription, weights);
                    // Cache the result
                    this.cache.set(cacheKey, {
                        data: result,
                        timestamp: Date.now()
                    });
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }
    /**
     * Batch analyze multiple candidates for better performance
     */
    async batchAnalyzeCandidates(candidates, jobDescription = "", weights) {
        if (candidates.length === 0)
            return [];
        if (candidates.length === 1) {
            // Single candidate - use regular analysis
            return [await this.analyzeCandidate(candidates[0], jobDescription, weights)];
        }
        // For multiple candidates, create a batch prompt
        const batchPrompt = this.createBatchPrompt(candidates, jobDescription, weights);
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert talent acquisition AI that provides precise candidate assessments. Always respond with valid JSON array."
                    },
                    {
                        role: "user",
                        content: batchPrompt
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.3
            });
            const analysis = JSON.parse(response.choices[0].message.content || "{}");
            // Validate and normalize the batch response
            if (Array.isArray(analysis.candidates)) {
                return analysis.candidates.map((candidate, index) => ({
                    skillMatch: Math.max(0, Math.min(10, candidate.skillMatch || 0)),
                    openToWork: Math.max(0, Math.min(10, candidate.openToWork || 0)),
                    jobStability: Math.max(0, Math.min(10, candidate.jobStability || 0)),
                    engagement: Math.max(0, Math.min(10, candidate.engagement || 0)),
                    companyConsistency: Math.max(0, Math.min(10, candidate.companyConsistency || 0)),
                    overallScore: Math.max(0, Math.min(10, candidate.overallScore || 0)),
                    priority: ['High', 'Medium', 'Low'].includes(candidate.priority) ? candidate.priority : 'Low',
                    insights: Array.isArray(candidate.insights) ? candidate.insights : []
                }));
            }
            // Fallback to individual analysis if batch fails
            console.warn('Batch analysis failed, falling back to individual analysis');
            const results = [];
            for (const candidate of candidates) {
                const result = await this.analyzeCandidate(candidate, jobDescription, weights);
                results.push(result);
            }
            return results;
        }
        catch (error) {
            console.error('Batch analysis failed:', error);
            // Fallback to individual analysis
            const results = [];
            for (const candidate of candidates) {
                const result = await this.analyzeCandidate(candidate, jobDescription, weights);
                results.push(result);
            }
            return results;
        }
    }
    /**
     * Enrich LinkedIn profile with rate limiting
     */
    async enrichLinkedInProfile(linkedinUrl, name, company) {
        const cacheKey = `linkedin_${name}_${company}`;
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                console.log(`Using cached LinkedIn data for ${name}`);
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }
        // Add to request queue for rate limiting
        return new Promise((resolve, reject) => {
            this.requestQueue.push(async () => {
                try {
                    const result = await this.performLinkedInEnrichment(linkedinUrl, name, company);
                    // Cache the result
                    this.cache.set(cacheKey, {
                        data: result,
                        timestamp: Date.now()
                    });
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }
    /**
     * Process the request queue with rate limiting
     */
    async processQueue() {
        if (this.isProcessing || this.activeRequests >= this.maxConcurrentRequests) {
            return;
        }
        this.isProcessing = true;
        while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
            const request = this.requestQueue.shift();
            if (request) {
                this.activeRequests++;
                // Process request
                request().finally(() => {
                    this.activeRequests--;
                });
                // Rate limiting delay
                await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
            }
        }
        this.isProcessing = false;
        // Continue processing if there are more requests
        if (this.requestQueue.length > 0) {
            setTimeout(() => this.processQueue(), this.rateLimitDelay);
        }
    }
    /**
     * Perform individual candidate analysis
     */
    async performAnalysis(candidateData, jobDescription, weights) {
        const prompt = `
You are an AI talent acquisition expert. Analyze the following candidate profile and provide a detailed assessment.

Candidate Data:
${JSON.stringify(candidateData, null, 2)}

Job Requirements/Description:
${jobDescription || "General software engineering position"}

Scoring Criteria Weights:
- Open to Work Signal: ${weights.openToWork}%
- Skill Match: ${weights.skillMatch}%
- Job Stability: ${weights.jobStability}%
- Platform Engagement: ${weights.engagement}%
- Company Consistency: ${weights.companyDifference}%

Please analyze this candidate and provide scores (0-10) for each criterion, an overall weighted score, priority level (High/Medium/Low), and actionable insights.

Consider the company consistency between resume and LinkedIn data as an important factor in assessing candidate reliability and current status.

Respond with JSON in this exact format:
{
  "skillMatch": number (0-10),
  "openToWork": number (0-10),
  "jobStability": number (0-10),
  "engagement": number (0-10),
  "companyConsistency": number (0-10),
  "overallScore": number (0-10),
  "priority": "High" | "Medium" | "Low",
  "insights": ["insight1", "insight2", "insight3"]
}
`;
        const response = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are an expert talent acquisition AI that provides precise candidate assessments. Always respond with valid JSON."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
        });
        const analysis = JSON.parse(response.choices[0].message.content || "{}");
        // Validate and normalize the response
        return {
            skillMatch: Math.max(0, Math.min(10, analysis.skillMatch || 0)),
            openToWork: Math.max(0, Math.min(10, analysis.openToWork || 0)),
            jobStability: Math.max(0, Math.min(10, analysis.jobStability || 0)),
            engagement: Math.max(0, Math.min(10, analysis.engagement || 0)),
            companyConsistency: Math.max(0, Math.min(10, analysis.companyConsistency || 0)),
            overallScore: Math.max(0, Math.min(10, analysis.overallScore || 0)),
            priority: ['High', 'Medium', 'Low'].includes(analysis.priority) ? analysis.priority : 'Low',
            insights: Array.isArray(analysis.insights) ? analysis.insights : []
        };
    }
    /**
     * Create batch prompt for multiple candidates
     */
    createBatchPrompt(candidates, jobDescription, weights) {
        return `
You are an AI talent acquisition expert. Analyze the following ${candidates.length} candidate profiles and provide detailed assessments.

Candidates Data:
${JSON.stringify(candidates, null, 2)}

Job Requirements/Description:
${jobDescription || "General software engineering position"}

Scoring Criteria Weights:
- Open to Work Signal: ${weights.openToWork}%
- Skill Match: ${weights.skillMatch}%
- Job Stability: ${weights.jobStability}%
- Platform Engagement: ${weights.engagement}%
- Company Consistency: ${weights.companyDifference}%

Please analyze each candidate and provide scores (0-10) for each criterion, an overall weighted score, priority level (High/Medium/Low), and actionable insights.

Respond with JSON in this exact format:
{
  "candidates": [
    {
      "skillMatch": number (0-10),
      "openToWork": number (0-10),
      "jobStability": number (0-10),
      "engagement": number (0-10),
      "companyConsistency": number (0-10),
      "overallScore": number (0-10),
      "priority": "High" | "Medium" | "Low",
      "insights": ["insight1", "insight2", "insight3"]
    }
  ]
}
`;
    }
    /**
     * Perform LinkedIn profile enrichment
     */
    async performLinkedInEnrichment(linkedinUrl, name, company) {
        // This is a mock implementation - replace with actual LinkedIn API calls
        // For now, return simulated data
        return {
            name,
            title: "Software Engineer",
            company: company || "Unknown",
            skills: ["JavaScript", "React", "Node.js", "Python"],
            openToWork: Math.random() > 0.5,
            lastActive: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            jobHistory: [
                {
                    company: company || "Unknown",
                    role: "Software Engineer",
                    duration: "2 years"
                }
            ],
            recentActivity: ["Updated profile", "Added new skill"],
            profileUrl: linkedinUrl
        };
    }
    /**
     * Generate cache key for analysis
     */
    generateAnalysisCacheKey(candidateData, weights) {
        const keyData = {
            name: candidateData.name?.toLowerCase(),
            email: candidateData.email?.toLowerCase(),
            company: candidateData.company?.toLowerCase(),
            skills: candidateData.skills?.sort().join(','),
            weights: JSON.stringify(weights)
        };
        return JSON.stringify(keyData);
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
    /**
     * Update rate limiting settings
     */
    updateRateLimit(delay, maxConcurrent) {
        this.rateLimitDelay = delay;
        this.maxConcurrentRequests = maxConcurrent;
    }
}
// Export singleton instance
export const optimizedOpenAI = OptimizedOpenAI.getInstance();
// Export individual functions for backward compatibility
export const analyzeCandidate = (candidateData, jobDescription, weights) => optimizedOpenAI.analyzeCandidate(candidateData, jobDescription, weights);
export const enrichLinkedInProfile = (linkedinUrl, name, company) => optimizedOpenAI.enrichLinkedInProfile(linkedinUrl, name, company);
export const batchAnalyzeCandidates = (candidates, jobDescription, weights) => optimizedOpenAI.batchAnalyzeCandidates(candidates, jobDescription, weights);
