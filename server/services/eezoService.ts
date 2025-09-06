import { db } from '../db.js';
import { candidates, activities } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { ResumeParser } from './resumeParser.js';
import { linkedInService } from './linkedin.js';
import { analyzeCandidate } from './openai.js';

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
      
      // Save candidate data with Eeezo context
      const candidateData = {
        comId: request.comId,
        eeezoUploadDate: new Date(),
        eeezoStatus: 'uploaded',
        name: extractedData.name,
        email: extractedData.email || null,
        phone: extractedData.phone || null,
        title: extractedData.title || null,
        company: extractedData.experience?.[0]?.company || null,
        linkedinUrl: extractedData.linkedinUrl || null,
        githubUrl: extractedData.githubUrl || null,
        portfolioUrl: extractedData.portfolioUrl || null,
        location: extractedData.location || null,
        summary: extractedData.summary || null,
        filename: filename,
        rawText: extractedData.rawText || null,
        experience: extractedData.experience || [],
        education: extractedData.education || [],
        projects: extractedData.projects || [],
        achievements: extractedData.achievements || [],
        interests: extractedData.interests || [],
        skills: extractedData.skills || [],
        certifications: extractedData.certifications || [],
        languages: extractedData.languages || [],
        source: 'eezo',
        dataSource: 'resume',
        enrichmentStatus: 'pending',
        originalData: extractedData,
        extractedData: extractedData,
        confidence: confidence,
        processingTime: processingTime,
        createdAt: new Date(),
        updatedAt: new Date()
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
          enrichmentStatus: 'in_progress',
          updatedAt: new Date()
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
          eeezoStatus: 'enriched',
          updatedAt: new Date()
        };
        
        // Map LinkedIn data to candidate fields
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
        if (linkedInProfile.skills) updateData.skills = linkedInProfile.skills;
        if (linkedInProfile.experience) updateData.experience = linkedInProfile.experience;
        if (linkedInProfile.education) updateData.education = linkedInProfile.education;
        if (linkedInProfile.certifications) updateData.certifications = linkedInProfile.certifications;
        if (linkedInProfile.profileUrl) updateData.linkedinUrl = linkedInProfile.profileUrl;
        if (linkedInProfile.openToWork !== undefined) updateData.openToWork = linkedInProfile.openToWork;
        if (linkedInProfile.lastActive) updateData.lastActive = linkedInProfile.lastActive;
        if (linkedInProfile.connections) updateData.linkedinConnections = linkedInProfile.connections;
        
        // Store enriched data
        updateData.enrichedData = linkedInProfile;
        
        await db.update(candidates)
          .set(updateData)
          .where(eq(candidates.id, candidateId));
        
        // Perform AI analysis
        try {
          const analysis = await analyzeCandidate(updateData, '', {
            openToWork: 30,
            skillMatch: 25,
            jobStability: 15,
            engagement: 15,
            companyDifference: 15
          });
          
          // Update with analysis results
          await db.update(candidates)
            .set({
              score: analysis.overallScore,
              priority: analysis.priority,
              hireabilityScore: analysis.overallScore, // Use overallScore as hireability score
              potentialToJoin: analysis.priority === 'High' ? 'High' : analysis.priority === 'Medium' ? 'Medium' : 'Low',
              hireabilityFactors: analysis.insights,
              eeezoStatus: 'completed'
            })
            .where(eq(candidates.id, candidateId));
          
        } catch (analysisError) {
          console.warn('AI analysis failed:', analysisError);
        }
        
        console.log(`LinkedIn enrichment completed for candidate ${candidateId}`);
        
      } else {
        // No LinkedIn data found
        await db.update(candidates)
          .set({ 
            enrichmentStatus: 'completed',
            enrichmentDate: new Date(),
            enrichmentSource: 'none',
            eeezoStatus: 'completed'
          })
          .where(eq(candidates.id, candidateId));
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
      const candidates = await db.select({
        eeezoStatus: candidates.eezoStatus,
        enrichmentStatus: candidates.enrichmentStatus,
        count: sql<number>`count(*)`
      })
      .from(candidates)
      .where(eq(candidates.comId, comId))
      .groupBy(candidates.eezoStatus, candidates.enrichmentStatus);
      
      const status = {
        totalCandidates: 0,
        uploaded: 0,
        processed: 0,
        enriched: 0,
        completed: 0,
        pendingEnrichment: 0,
        failedEnrichment: 0
      };
      
      candidates.forEach(candidate => {
        status.totalCandidates += candidate.count;
        
        switch (candidate.eezoStatus) {
          case 'uploaded':
            status.uploaded += candidate.count;
            break;
          case 'processed':
            status.processed += candidate.count;
            break;
          case 'enriched':
            status.enriched += candidate.count;
            break;
          case 'completed':
            status.completed += candidate.count;
            break;
        }
        
        switch (candidate.enrichmentStatus) {
          case 'pending':
            status.pendingEnrichment += candidate.count;
            break;
          case 'failed':
            status.failedEnrichment += candidate.count;
            break;
        }
      });
      
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
          notes: updateData.notes,
          updatedAt: new Date()
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
}
