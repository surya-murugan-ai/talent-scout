import { FileProcessor, ProcessedCandidate } from './fileProcessor.js';
import { analyzeCandidate, enrichLinkedInProfile } from './openai.js';
import { storage } from '../storage.js';

export interface ProcessingOptions {
  batchSize?: number;
  enableCaching?: boolean;
  parallelProcessing?: boolean;
  progressCallback?: (progress: number, message: string) => void;
}

export class OptimizedResumeProcessor {
  private static instance: OptimizedResumeProcessor;
  private processingCache: Map<string, any> = new Map();
  private dbConnection: any = null;
  
  private constructor() {}
  
  static getInstance(): OptimizedResumeProcessor {
    if (!OptimizedResumeProcessor.instance) {
      OptimizedResumeProcessor.instance = new OptimizedResumeProcessor();
    }
    return OptimizedResumeProcessor.instance;
  }

  /**
   * Process a single resume file with optimized performance
   */
  async processSingleResume(
    buffer: Buffer, 
    filename: string, 
    options: ProcessingOptions = {}
  ): Promise<{ success: boolean; candidates: ProcessedCandidate[]; processingTime: number }> {
    const startTime = Date.now();
    
    try {
      options.progressCallback?.(10, "Starting file processing...");
      
      // Process the file
      const candidates = await FileProcessor.processFile(buffer, filename);
      
      options.progressCallback?.(25, `Extracted ${candidates.length} candidates`);
      
      if (candidates.length === 0) {
        return { success: true, candidates: [], processingTime: Date.now() - startTime };
      }

      // Get scoring weights
      const project = await storage.getProject("default-project");
      const weights = (project?.scoringWeights as any) || {
        openToWork: 30,
        skillMatch: 25,
        jobStability: 15,
        engagement: 15,
        companyDifference: 15
      };

      // Process candidates with optimized approach
      const processedCandidates = await this.processCandidatesOptimized(
        candidates, 
        weights, 
        options
      );

      options.progressCallback?.(100, "Processing completed successfully!");
      
      return {
        success: true,
        candidates: processedCandidates,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Single resume processing failed:', error);
      options.progressCallback?.(0, `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        candidates: [],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process multiple candidates with optimized performance
   */
  private async processCandidatesOptimized(
    candidates: ProcessedCandidate[],
    weights: any,
    options: ProcessingOptions
  ): Promise<ProcessedCandidate[]> {
    const batchSize = options.batchSize || 5;
    const processedCandidates: ProcessedCandidate[] = [];
    
    // Process in batches for better performance
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      
      options.progressCallback?.(
        25 + Math.round((i / candidates.length) * 70),
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(candidates.length / batchSize)}`
      );

      if (options.parallelProcessing) {
        // Process batch in parallel
        const batchPromises = batch.map(candidate => 
          this.processSingleCandidate(candidate, weights, options)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            processedCandidates.push(result.value);
          }
        });
      } else {
        // Process batch sequentially (for rate limiting)
        for (const candidate of batch) {
          const processed = await this.processSingleCandidate(candidate, weights, options);
          if (processed) {
            processedCandidates.push(processed);
          }
        }
      }

      // Small delay between batches to prevent overwhelming APIs
      if (i + batchSize < candidates.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return processedCandidates;
  }

  /**
   * Process a single candidate with caching and optimization
   */
  private async processSingleCandidate(
    candidateData: ProcessedCandidate,
    weights: any,
    options: ProcessingOptions
  ): Promise<ProcessedCandidate | null> {
    try {
      // Check cache first if enabled
      const cacheKey = this.generateCacheKey(candidateData);
      if (options.enableCaching && this.processingCache.has(cacheKey)) {
        console.log(`Using cached result for ${candidateData.name}`);
        return this.processingCache.get(cacheKey);
      }

      // Check if candidate already exists
      let existingCandidate = null;
      if (candidateData.email) {
        existingCandidate = await storage.getCandidateByEmail(candidateData.email);
      }
      
      if (!existingCandidate && candidateData.name && candidateData.company) {
        const candidates = await storage.getCandidates(1000, 0);
        existingCandidate = candidates.find(c => 
          c.name?.toLowerCase() === candidateData.name?.toLowerCase() && 
          c.company?.toLowerCase() === candidateData.company?.toLowerCase()
        );
      }

      // Create or update candidate
      let resumeCandidate;
      if (existingCandidate) {
        resumeCandidate = await storage.updateCandidate(existingCandidate.id, {
          title: candidateData.title || existingCandidate.title,
          company: candidateData.company || existingCandidate.company,
          currentEmployer: candidateData.company || existingCandidate.currentEmployer,
          skills: candidateData.skills || existingCandidate.skills,
          extractedData: candidateData,
          source: 'resume'
        });
        resumeCandidate = await storage.getCandidate(existingCandidate.id);
      } else {
        resumeCandidate = await storage.createCandidate({
          name: candidateData.name,
          email: candidateData.email,
          title: candidateData.title,
          company: candidateData.company,
          currentEmployer: candidateData.company,
          linkedinUrl: candidateData.linkedinUrl || `https://linkedin.com/in/${candidateData.name.toLowerCase().replace(/\s+/g, '-')}`,
          skills: candidateData.skills,
          score: 0,
          priority: 'Low',
          openToWork: false,
          lastActive: 'Unknown',
          notes: 'Resume processed, awaiting LinkedIn enrichment',
          originalData: candidateData.originalData,
          extractedData: candidateData,
          source: 'resume'
        });
      }

      // Enrich with LinkedIn data
      const linkedInUrl = candidateData.linkedinUrl || `https://linkedin.com/in/${candidateData.name.toLowerCase().replace(/\s+/g, '-')}`;
      const linkedInProfile = await enrichLinkedInProfile(
        linkedInUrl,
        candidateData.name,
        candidateData.company
      );

      // Analyze with OpenAI
      const analysis = await analyzeCandidate({
        ...candidateData,
        linkedinProfile: linkedInProfile,
        resumeCompany: candidateData.company,
        linkedinCompany: linkedInProfile.company
      }, "", weights);

      // Calculate company difference
      const resumeCompany = candidateData.company;
      const linkedinCompany = linkedInProfile.company;
      const hasCompanyDifference = resumeCompany && linkedinCompany && 
        resumeCompany !== linkedinCompany;
      const companyDifference = hasCompanyDifference ? "Different" : "Same";
      const companyDifferenceScore = hasCompanyDifference ? weights.companyDifference : 0;

      // Calculate hireability
      const hireabilityScore = this.calculateHireabilityScore(candidateData, linkedInProfile, analysis);
      const hireabilityFactors = this.calculateHireabilityFactors(candidateData, linkedInProfile, analysis);

      // Update candidate with enriched data
      if (resumeCandidate) {
        await storage.updateCandidate(resumeCandidate.id, {
          title: linkedInProfile.title || candidateData.title,
          company: candidateData.company,
          currentEmployer: linkedInProfile.company,
          skills: linkedInProfile.skills.length > 0 ? linkedInProfile.skills : candidateData.skills,
          score: analysis.overallScore,
          priority: analysis.priority,
          openToWork: linkedInProfile.openToWork,
          lastActive: linkedInProfile.lastActive,
          notes: analysis.insights.join('; '),
          companyDifference: companyDifference,
          companyDifferenceScore: companyDifferenceScore,
          hireabilityScore: hireabilityScore,
          hireabilityFactors: hireabilityFactors,
          enrichedData: linkedInProfile
        });
      }

      // Cache result if enabled
      if (options.enableCaching) {
        this.processingCache.set(cacheKey, candidateData);
      }

      return candidateData;

    } catch (error) {
      console.error(`Error processing candidate ${candidateData.name}:`, error);
      return null;
    }
  }

  /**
   * Generate cache key for candidate data
   */
  private generateCacheKey(candidateData: ProcessedCandidate): string {
    const keyData = {
      name: candidateData.name?.toLowerCase(),
      email: candidateData.email?.toLowerCase(),
      company: candidateData.company?.toLowerCase(),
      skills: candidateData.skills?.sort().join(',')
    };
    return JSON.stringify(keyData);
  }

  /**
   * Calculate hireability score
   */
  private calculateHireabilityScore(resumeData: any, linkedInProfile: any, analysis: any): number {
    let score = 0;
    
    // Base score from analysis
    score += analysis.overallScore * 0.4;
    
    // Company difference bonus (if different, might indicate job seeking)
    if (resumeData.company && linkedInProfile.company && 
        resumeData.company !== linkedInProfile.company) {
      score += 2; // Bonus for potential job seekers
    }
    
    // Open to work bonus
    if (linkedInProfile.openToWork) {
      score += 1.5;
    }
    
    // Recent activity bonus
    if (linkedInProfile.lastActive) {
      const lastActive = new Date(linkedInProfile.lastActive);
      const daysSince = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 7) score += 1;
      else if (daysSince <= 30) score += 0.5;
    }
    
    return Math.min(10, Math.max(0, score));
  }

  /**
   * Calculate hireability factors
   */
  private calculateHireabilityFactors(resumeData: any, linkedInProfile: any, analysis: any): any {
    return {
      companyConsistency: resumeData.company === linkedInProfile.company,
      openToWork: linkedInProfile.openToWork,
      recentActivity: linkedInProfile.lastActive,
      skillMatch: analysis.skillMatch,
      overallScore: analysis.overallScore
    };
  }

  /**
   * Clear processing cache
   */
  clearCache(): void {
    this.processingCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.processingCache.size,
      keys: Array.from(this.processingCache.keys())
    };
  }
}


