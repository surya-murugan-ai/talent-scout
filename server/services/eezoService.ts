import { db } from '../db.js';
import { candidates, activities } from '../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { ResumeParser } from './resumeParser.js';
import { linkedInService } from './linkedin.js';
import { analyzeCandidate } from './openai.js';
import { IndividualScoringService } from './individualScoringService.js';
import { storage } from '../storage.js';

interface EeezoResumeRequest {
  comId: string;
  file: Express.Multer.File;
  processingJobId: string;
}

interface EeezoProcessingResult {
  candidateId: string;
  success: boolean;
  message: string;
}

export class EeezoService {
  
  /**
   * Process resume from Eeezo with company ID
   */
  static async processEeezoResume(request: EeezoResumeRequest): Promise<EeezoProcessingResult> {
    try {
      console.log('=== EEEZO RESUME PROCESSING ===');
      console.log('Company ID:', request.comId);
      console.log('Resume URL:', request.resumeUrl);
      console.log('File:', request.file?.originalname);
      
      let extractedData;
      let filename = 'eezo-resume';
      let processingTime = 0;
      let confidence = 0;
      
      // Process resume file
      if (!request.file) {
        throw new Error('Resume file is required');
      }
      
      // Process uploaded file
      const startTime = Date.now();
      const files = [{ buffer: request.file.buffer, filename: request.file.originalname }];
      const resumeData = await ResumeParser.parseMultipleResumes(files);
      
      if (resumeData.length === 0) {
        throw new Error('Failed to extract data from resume file');
      }
      
      extractedData = resumeData[0].extractedData;
      filename = request.file.originalname;
      processingTime = Date.now() - startTime;
      confidence = resumeData[0].confidence;
      
      // Check if extraction was successful
      if (confidence === 0 && (!extractedData.name || extractedData.name === null)) {
        console.warn('⚠️  Resume text extraction failed - PDF may be image-based or corrupted');
        console.log('Raw text length:', resumeData[0].rawText?.length || 0);
        
        // Still save the candidate but with error indication
        extractedData = {
          ...extractedData,
          name: `Unknown (Text extraction failed)`,
          summary: 'Resume text could not be extracted. This may be an image-based PDF that requires OCR.',
          originalData: {
            filename: filename,
            rawText: resumeData[0].rawText || '',
            extractionError: 'PDF text extraction failed - may be image-based'
          }
        };
        confidence = 0;
      }
      
      // Enhanced field mapping from resume parser output
      const candidateData = {
        // Eeezo-specific fields
        comId: request.comId,
        eeezoUploadDate: new Date(),
        eeezoStatus: 'uploaded',
        
        // Basic Information
        name: extractedData.name || "Unknown",
        email: extractedData.email || null,
        phone: extractedData.phone || null,
        title: extractedData.title || null,
        company: extractedData.experience?.[0]?.company || null,
        linkedinUrl: extractedData.linkedinUrl || null,
        githubUrl: extractedData.githubUrl || null,
        portfolioUrl: extractedData.portfolioUrl || null,
        location: extractedData.location || null,
        summary: extractedData.summary || null,
        
        // Resume-specific fields
        filename: filename,
        rawText: extractedData.originalData?.rawText || null,
        experience: extractedData.experience || [],
        education: extractedData.education || [],
        projects: extractedData.projects || [],
        achievements: extractedData.achievements || [],
        interests: extractedData.interests || [],
        skills: extractedData.skills || [],
        certifications: extractedData.certifications || [],
        languages: extractedData.languages || [],
        
        // Enhanced fields - extract from name
        firstName: extractedData.name ? extractedData.name.split(' ')[0] : null,
        lastName: extractedData.name ? extractedData.name.split(' ').slice(1).join(' ') : null,
        
        // Enhanced fields - extract from experience
        currentTitle: extractedData.experience?.[0]?.jobTitle || extractedData.title || null,
        currentCompany: extractedData.experience?.[0]?.company || null,
        
        // Calculate years of experience from experience array
        yearsOfExperience: this.calculateYearsOfExperience(extractedData.experience || []),
        
        // Work history (same as experience for now)
        workHistory: extractedData.experience || [],
        
        // Additional fields from resume (not available in current extraction)
        salary: null,
        availability: null,
        remotePreference: null,
        visaStatus: null,
        
        // Data source and processing
        source: 'eezo',
        dataSource: 'resume',
        enrichmentStatus: 'pending',
        originalData: extractedData,
        extractedData: extractedData,
        confidence: confidence,
        processingTime: processingTime,
        createdAt: new Date(),
        
        // Resume status
        resumeStatus: 'active'
      };
      
      // Insert candidate into database
      const [savedCandidate] = await db.insert(candidates)
        .values(candidateData)
        .returning();
      
      // Log activity
      await db.insert(activities).values({
        type: 'eezo_upload',
        message: `Eeezo resume processed for ${extractedData.name}`,
        details: `Company: ${request.comId}, File: ${filename}, Confidence: ${confidence}%`
      });
      
      // Start LinkedIn enrichment in background
      this.enrichCandidateInBackground(savedCandidate.id, extractedData);
      
      console.log('=== EEEZO RESUME SAVED SUCCESSFULLY ===');
      console.log('Candidate ID:', savedCandidate.id);
      console.log('Company ID:', request.comId);
      
      return {
        candidateId: savedCandidate.id,
        success: true,
        message: 'Resume processed successfully'
      };
      
    } catch (error) {
      console.error('Eeezo processing error:', error);
      
      // Log error activity
      await db.insert(activities).values({
        type: 'eezo_error',
        message: `Eeezo resume processing failed for company ${request.comId}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new Error(`Eeezo processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  
  /**
   * Enrich candidate with LinkedIn data in background
   */
  private static async enrichCandidateInBackground(candidateId: string, extractedData: any) {
    try {
      console.log(`Starting LinkedIn enrichment for candidate ${candidateId}`);
      
      // Update enrichment status
      await db.update(candidates)
        .set({ 
          enrichmentStatus: 'in_progress'
        })
        .where(eq(candidates.id, candidateId));
      
      // Enrich with LinkedIn data
      const linkedInProfile = await linkedInService.enrichProfile(
        extractedData.linkedinUrl,
        extractedData.name,
        extractedData.experience?.[0]?.company,
        extractedData.title,
        extractedData.location,
        [{ id: candidateId, ...extractedData }]
      );
      
      if (linkedInProfile) {
        // Update candidate with LinkedIn data
        const updateData: any = {
          enrichmentStatus: 'completed',
          enrichmentDate: new Date(),
          enrichmentSource: 'harvestapi',
          eeezoStatus: 'enriched'
        };
        
        // Map LinkedIn data to candidate fields (preserve resume data, only add LinkedIn-specific fields)
        if (linkedInProfile.name) updateData.name = linkedInProfile.name;
        if (linkedInProfile.title || linkedInProfile.headline) {
          updateData.title = linkedInProfile.title || linkedInProfile.headline;
        }
        if (linkedInProfile.company || linkedInProfile.currentCompany) {
          updateData.currentEmployer = linkedInProfile.company || linkedInProfile.currentCompany;
        }
        if (linkedInProfile.location) updateData.location = linkedInProfile.location;
        if (linkedInProfile.summary || linkedInProfile.about) {
          updateData.summary = linkedInProfile.summary || linkedInProfile.about;
        }
        // Merge skills instead of replacing (resume skills + LinkedIn skills)
        if (linkedInProfile.skills) {
          const existingSkills = updateData.skills || [];
          const linkedinSkills = Array.isArray(linkedInProfile.skills) 
            ? linkedInProfile.skills.map(s => typeof s === 'string' ? s : s.title || s.name || s)
            : [];
          updateData.skills = [...new Set([...existingSkills, ...linkedinSkills])];
        }
        // Don't overwrite experience, education, certifications - keep resume data
        // Only add LinkedIn-specific fields
        if (linkedInProfile.profileUrl) updateData.linkedinUrl = linkedInProfile.profileUrl;
        if (linkedInProfile.openToWork !== undefined) updateData.openToWork = linkedInProfile.openToWork;
        if (linkedInProfile.lastActive) updateData.lastActive = linkedInProfile.lastActive;
        if (linkedInProfile.connections) updateData.linkedinConnections = linkedInProfile.connections;
        
        // Add LinkedIn-specific fields
        if (linkedInProfile.headline) updateData.linkedinHeadline = linkedInProfile.headline;
        if (linkedInProfile.about) updateData.linkedinSummary = linkedInProfile.about;
        if (linkedInProfile.lastActive) {
          try {
            const lastActiveDate = new Date(linkedInProfile.lastActive);
            if (!isNaN(lastActiveDate.getTime())) {
              updateData.linkedinLastActive = lastActiveDate;
            }
          } catch (error) {
            console.warn('Invalid lastActive date:', linkedInProfile.lastActive, error);
          }
        }
        
        // Store enriched data
        updateData.enrichedData = linkedInProfile;
        
        await db.update(candidates)
          .set(updateData)
          .where(eq(candidates.id, candidateId));
        
        // Perform individual scoring analysis
        try {
          // Get candidate data for scoring
          const candidateData = await db.select()
            .from(candidates)
            .where(eq(candidates.id, candidateId))
            .limit(1);
          
          if (candidateData[0]) {
            const candidate = candidateData[0];
            
            // Calculate individual scores
            const individualScores = IndividualScoringService.calculateIndividualScores({
              name: candidate.name || undefined,
              email: candidate.email || undefined,
              summary: candidate.summary || candidate.linkedinSummary || undefined,
              openToWork: candidate.openToWork || undefined,
              linkedinLastActive: candidate.linkedinLastActive || undefined,
              linkedinConnections: candidate.linkedinConnections || undefined,
              linkedinNotes: candidate.linkedinNotes || undefined,
              linkedinSummary: candidate.linkedinSummary || undefined,
              experience: Array.isArray(candidate.experience) ? candidate.experience : [],
              skills: Array.isArray(candidate.skills) ? candidate.skills : []
            });
            
            // Calculate overall priority based on individual scores
            const avgScore = (individualScores.openToWorkScore + individualScores.jobStabilityScore + individualScores.platformEngagementScore) / 3;
            let priority = 'Low';
            if (avgScore >= 7) priority = 'High';
            else if (avgScore >= 5) priority = 'Medium';
            
            // Update with individual scores
            await db.update(candidates)
              .set({
                openToWorkScore: individualScores.openToWorkScore,
                jobStabilityScore: individualScores.jobStabilityScore,
                platformEngagementScore: individualScores.platformEngagementScore,
                skillMatchScore: individualScores.skillMatchScore,
                priority: priority,
                hireabilityScore: avgScore,
                potentialToJoin: priority,
                eeezoStatus: 'completed'
              })
              .where(eq(candidates.id, candidateId));
            
            console.log(`✅ Individual scoring completed for candidate ${candidateId}:`, {
              openToWork: individualScores.openToWorkScore,
              jobStability: individualScores.jobStabilityScore,
              platformEngagement: individualScores.platformEngagementScore,
              priority,
              avgScore
            });
          }
          
        } catch (analysisError) {
          console.warn('Individual scoring failed:', analysisError);
        }
        
        console.log(`LinkedIn enrichment completed for candidate ${candidateId}`);
        
      } else {
        // No LinkedIn data found - still perform individual scoring with resume data only
        try {
          const candidateData = await db.select()
            .from(candidates)
            .where(eq(candidates.id, candidateId))
            .limit(1);
          
          if (candidateData[0]) {
            const candidate = candidateData[0];
            
            // Calculate individual scores (without LinkedIn data)
            const individualScores = IndividualScoringService.calculateIndividualScores({
              name: candidate.name || undefined,
              email: candidate.email || undefined,
              summary: candidate.summary || undefined,
              openToWork: candidate.openToWork || false,
              experience: Array.isArray(candidate.experience) ? candidate.experience : [],
              skills: Array.isArray(candidate.skills) ? candidate.skills : []
            });
            
            // Calculate overall priority based on available scores
            const avgScore = (individualScores.openToWorkScore + individualScores.jobStabilityScore) / 2; // No platform engagement without LinkedIn
            let priority = 'Low';
            if (avgScore >= 7) priority = 'High';
            else if (avgScore >= 5) priority = 'Medium';
            
            await db.update(candidates)
              .set({ 
                enrichmentStatus: 'completed',
                enrichmentDate: new Date(),
                enrichmentSource: 'none',
                openToWorkScore: individualScores.openToWorkScore,
                jobStabilityScore: individualScores.jobStabilityScore,
                platformEngagementScore: 0, // No LinkedIn data available
                skillMatchScore: individualScores.skillMatchScore,
                priority: priority,
                hireabilityScore: avgScore,
                potentialToJoin: priority,
                eeezoStatus: 'completed'
              })
              .where(eq(candidates.id, candidateId));
              
            console.log(`✅ Resume-only scoring completed for candidate ${candidateId}:`, {
              openToWork: individualScores.openToWorkScore,
              jobStability: individualScores.jobStabilityScore,
              platformEngagement: 0,
              priority,
              avgScore
            });
          }
        } catch (scoringError) {
          console.warn('Resume-only scoring failed:', scoringError);
          // Fallback update
          await db.update(candidates)
            .set({ 
              enrichmentStatus: 'completed',
              enrichmentDate: new Date(),
              enrichmentSource: 'none',
              eeezoStatus: 'completed'
            })
            .where(eq(candidates.id, candidateId));
        }
      }
      
    } catch (error) {
      console.error(`LinkedIn enrichment failed for candidate ${candidateId}:`, error);
      
      // Update status to failed
      await db.update(candidates)
        .set({ 
          enrichmentStatus: 'failed',
          enrichmentDate: new Date()
        })
        .where(eq(candidates.id, candidateId));
    }
  }
  
  /**
   * Get candidates by company ID
   */
  static async getCandidatesByCompanyId(comId: string, options: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    try {
      let query = db.select().from(candidates)
        .where(eq(candidates.comId, comId))
        .orderBy(candidates.createdAt);
      
      if (options.status) {
        query = query.where(and(
          eq(candidates.comId, comId),
          eq(candidates.eezoStatus, options.status)
        ));
      }
      
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      if (options.offset) {
        query = query.offset(options.offset);
      }
      
      return await query;
      
    } catch (error) {
      console.error('Error fetching candidates by company ID:', error);
      throw new Error(`Failed to fetch candidates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get Eeezo processing status for a company
   */
  static async getEeezoProcessingStatus(comId: string) {
    try {
      console.log(`Fetching Eeezo status for comId: ${comId}`);
      
      // First, let's get all candidates for this comId to see what we have
      const allCandidates = await db.select()
        .from(candidates)
        .where(eq(candidates.comId, comId));
      
      console.log(`Found ${allCandidates.length} candidates for comId ${comId}`);
      
      const status = {
        totalCandidates: allCandidates.length,
        uploaded: 0,
        processed: 0,
        enriched: 0,
        completed: 0,
        pendingEnrichment: 0,
        failedEnrichment: 0
      };
      
      // Count by status
      allCandidates.forEach(candidate => {
        if (candidate.eezoStatus) {
          switch (candidate.eezoStatus) {
            case 'uploaded':
              status.uploaded++;
              break;
            case 'processed':
              status.processed++;
              break;
            case 'enriched':
              status.enriched++;
              break;
            case 'completed':
              status.completed++;
              break;
          }
        }
        
        if (candidate.enrichmentStatus) {
          switch (candidate.enrichmentStatus) {
            case 'pending':
              status.pendingEnrichment++;
              break;
            case 'failed':
              status.failedEnrichment++;
              break;
          }
        }
      });
      
      console.log('Status result:', status);
      return status;
      
    } catch (error) {
      console.error('Error fetching Eeezo status:', error);
      throw new Error(`Failed to fetch status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update candidate Eeezo status
   */
  static async updateCandidateEeezoStatus(candidateId: string, updateData: {
    eeezoStatus?: string;
    notes?: string;
  }) {
    try {
      const [updatedCandidate] = await db.update(candidates)
        .set({
          eeezoStatus: updateData.eezoStatus,
          notes: updateData.notes
        })
        .where(eq(candidates.id, candidateId))
        .returning();
      
      // Log activity
      await db.insert(activities).values({
        type: 'eezo_status_update',
        message: `Eeezo status updated for candidate ${candidateId}`,
        details: `Status: ${updateData.eezoStatus}, Notes: ${updateData.notes || 'None'}`
      });
      
      return updatedCandidate;
      
    } catch (error) {
      console.error('Error updating candidate Eeezo status:', error);
      throw new Error(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate years of experience from experience array
   */
  private static calculateYearsOfExperience(experience: any[]): number | null {
    if (!experience || experience.length === 0) {
      return null;
    }

    try {
      let totalMonths = 0;
      const currentDate = new Date();
      
      for (const exp of experience) {
        if (exp.startDate && exp.endDate) {
          try {
            const startDate = new Date(exp.startDate);
            const endDate = exp.endDate === 'Present' || exp.endDate === 'Current' ? currentDate : new Date(exp.endDate);
            
            if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
              totalMonths += Math.max(0, months);
            }
          } catch (error) {
            console.warn('Invalid date in experience:', exp.startDate, exp.endDate, error);
          }
        } else if (exp.duration) {
          // Try to parse duration string like "2 years 6 months" or "3 years"
          const durationMatch = exp.duration.match(/(\d+)\s*(?:year|yr|y)/i);
          if (durationMatch) {
            totalMonths += parseInt(durationMatch[1]) * 12;
          }
        }
      }
      
      return totalMonths > 0 ? Math.round((totalMonths / 12) * 10) / 10 : null; // Round to 1 decimal place
    } catch (error) {
      console.warn('Error calculating years of experience:', error);
      return null;
    }
  }
}
