import { db } from '../db.js';
import { candidates, activities } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import type { ComprehensiveResumeData } from './resumeParser.js';

export class ResumeDataService {
  
  /**
   * Save extracted resume data to database
   */
  static async saveResumeData(
    extractedData: ComprehensiveResumeData,
    filename: string,
    processingTime: number,
    confidence: number
  ) {
    try {
      console.log('=== SAVING RESUME DATA TO DATABASE ===');
      console.log('Filename:', filename);
      console.log('Candidate Name:', extractedData.name);
      
      // First, create or update the candidate record
      const candidateData = {
        name: extractedData.name,
        email: extractedData.email || null,
        phone: extractedData.phone || null,
        title: extractedData.title || null,
        company: extractedData.experience?.[0]?.company || null,
        linkedinUrl: extractedData.linkedinUrl || null,
        githubUrl: extractedData.githubUrl || null,
        portfolioUrl: extractedData.portfolioUrl || null,
        location: extractedData.location || null,
        skills: extractedData.skills || [],
        source: 'resume',
        extractedData: extractedData,
        confidence: confidence,
        processingTime: processingTime,
      };

      // Check if candidate already exists by email or name
      let existingCandidate = null;
      if (candidateData.email) {
        existingCandidate = await db.select().from(candidates)
          .where(eq(candidates.email, candidateData.email))
          .limit(1);
      }
      
      if (!existingCandidate?.length && candidateData.name) {
        existingCandidate = await db.select().from(candidates)
          .where(eq(candidates.name, candidateData.name))
          .limit(1);
      }

      let candidateId: string;
      
      if (existingCandidate?.length) {
        // Update existing candidate
        const candidate = existingCandidate[0];
        candidateId = candidate.id;
        
        await db.update(candidates)
          .set({
            ...candidateData
          })
          .where(eq(candidates.id, candidateId));
          
        console.log('Updated existing candidate:', candidateId);
      } else {
        // Create new candidate
        const [newCandidate] = await db.insert(candidates)
          .values({
            ...candidateData,
            name: candidateData.name || "Unknown",
            email: candidateData.email || undefined,
            phone: candidateData.phone || undefined,
            title: candidateData.title || undefined,
            company: candidateData.company || undefined,
            linkedinUrl: candidateData.linkedinUrl || undefined,
            githubUrl: candidateData.githubUrl || undefined,
            portfolioUrl: candidateData.portfolioUrl || undefined
          })
          .returning({ id: candidates.id });
          
        candidateId = newCandidate.id;
        console.log('Created new candidate:', candidateId);
      }

      // Save detailed resume data
      const resumeDataRecord = {
        candidateId: candidateId,
        filename: filename,
        name: extractedData.name,
        email: extractedData.email || null,
        phone: extractedData.phone || null,
        linkedinUrl: extractedData.linkedinUrl || null,
        githubUrl: extractedData.githubUrl || null,
        portfolioUrl: extractedData.portfolioUrl || null,
        location: extractedData.location || null,
        title: extractedData.title || null,
        summary: extractedData.summary || null,
        experience: extractedData.experience || [],
        education: extractedData.education || [],
        projects: extractedData.projects || [],
        achievements: extractedData.achievements || [],
        certifications: extractedData.certifications || [],
        skills: extractedData.skills || [],
        interests: extractedData.interests || [],
        languages: extractedData.languages || [],
        rawText: extractedData.originalData?.rawText || null,
        confidence: confidence,
        processingTime: processingTime,
        source: 'resume',
      };

      // Resume data is now stored directly in candidates table
      // const [savedResumeData] = await db.insert(resumeData)
      //   .values(resumeDataRecord)
      //   .returning();

      // Log activity
      await db.insert(activities).values({
        type: 'resume_upload',
        message: `Resume processed for ${extractedData.name}`,
        details: `File: ${filename}, Confidence: ${confidence}%, Processing Time: ${processingTime}ms`
      });

      console.log('=== RESUME DATA SAVED SUCCESSFULLY ===');
      console.log('Candidate ID:', candidateId);
      
      return {
        candidateId,
        resumeDataId: candidateId,
        success: true
      };

    } catch (error) {
      console.error('Error saving resume data:', error);
      throw new Error(`Failed to save resume data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all resume data with candidate information
   */
  static async getAllResumeData() {
    try {
      // Resume data is now stored directly in candidates table
      const result = await db
        .select()
        .from(candidates)
        .orderBy(candidates.createdAt);

      return result;
    } catch (error) {
      console.error('Error fetching resume data:', error);
      throw new Error(`Failed to fetch resume data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get resume data by ID
   */
  static async getResumeDataById(id: string) {
    try {
      const result = await db
        .select({
          resumeData: resumeData,
          candidate: candidates,
        })
        .from(resumeData)
        .leftJoin(candidates, eq(resumeData.candidateId, candidates.id))
        .where(eq(resumeData.id, id))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error fetching resume data by ID:', error);
      throw new Error(`Failed to fetch resume data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get resume data by candidate ID
   */
  static async getResumeDataByCandidateId(candidateId: string) {
    try {
      const result = await db
        .select()
        .from(resumeData)
        .where(eq(resumeData.candidateId, candidateId))
        .orderBy(resumeData.createdAt);

      return result;
    } catch (error) {
      console.error('Error fetching resume data by candidate ID:', error);
      throw new Error(`Failed to fetch resume data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete resume data by ID
   */
  static async deleteResumeData(id: string) {
    try {
      const result = await db
        .delete(resumeData)
        .where(eq(resumeData.id, id))
        .returning();

      if (result.length > 0) {
        // Log activity
        await db.insert(activities).values({
          type: 'resume_delete',
          message: `Resume data deleted`,
          details: `Resume Data ID: ${id}`
        });
      }

      return result[0] || null;
    } catch (error) {
      console.error('Error deleting resume data:', error);
      throw new Error(`Failed to delete resume data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update candidate with LinkedIn data
   */
  static async updateCandidateWithLinkedInData(
    candidateId: string,
    linkedInData: any,
    source: 'dev_fusion' | 'harvestapi' = 'harvestapi'
  ) {
    try {
      console.log(`Updating candidate ${candidateId} with LinkedIn data from ${source}`);
      
      // Transform LinkedIn data to match our schema
      const updateData: any = {
        updatedAt: new Date(),
        linkedinLastActive: new Date(),
        source: source === 'dev_fusion' ? 'dev_fusion' : 'harvestapi'
      };

      // Map LinkedIn data to candidate fields
      if (linkedInData.name) {
        updateData.name = linkedInData.name;
      }
      
      if (linkedInData.title || linkedInData.headline) {
        updateData.title = linkedInData.title || linkedInData.headline;
      }
      
      if (linkedInData.company || linkedInData.currentCompany) {
        updateData.currentEmployer = linkedInData.company || linkedInData.currentCompany;
      }
      
      if (linkedInData.location) {
        updateData.location = linkedInData.location;
      }
      
      if (linkedInData.skills && Array.isArray(linkedInData.skills)) {
        updateData.skills = linkedInData.skills;
      }
      
      if (linkedInData.openToWork !== undefined) {
        updateData.openToWork = linkedInData.openToWork;
      }
      
      if (linkedInData.profileUrl || linkedInData.linkedinUrl) {
        updateData.linkedinUrl = linkedInData.profileUrl || linkedInData.linkedinUrl;
      }

      // Update the candidate
      const result = await db
        .update(candidates)
        .set(updateData)
        .where(eq(candidates.id, candidateId))
        .returning();

      if (result.length > 0) {
        console.log(`✅ Successfully updated candidate ${candidateId} with LinkedIn data`);
        
        // Log activity
        await db.insert(activities).values({
          type: 'linkedin_update',
          message: `Candidate updated with LinkedIn data from ${source}`,
          details: `Candidate ID: ${candidateId}, Source: ${source}`
        });
        
        return result[0];
      }

      return null;
    } catch (error) {
      console.error('Error updating candidate with LinkedIn data:', error);
      throw new Error(`Failed to update candidate with LinkedIn data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update resume data with LinkedIn enrichment
   */
  static async updateResumeDataWithLinkedIn(
    resumeDataId: string,
    linkedInData: any,
    source: 'dev_fusion' | 'harvestapi' = 'harvestapi'
  ) {
    try {
      console.log(`Updating resume data ${resumeDataId} with LinkedIn enrichment from ${source}`);
      
      // Transform LinkedIn data to match resume data schema
      const updateData: any = {
        updatedAt: new Date()
      };

      // Map LinkedIn data to resume data fields
      if (linkedInData.name) {
        updateData.name = linkedInData.name;
      }
      
      if (linkedInData.title || linkedInData.headline) {
        updateData.title = linkedInData.title || linkedInData.headline;
      }
      
      if (linkedInData.location) {
        updateData.location = linkedInData.location;
      }
      
      if (linkedInData.summary || linkedInData.about) {
        updateData.summary = linkedInData.summary || linkedInData.about;
      }
      
      if (linkedInData.experience && Array.isArray(linkedInData.experience)) {
        updateData.experience = linkedInData.experience;
      }
      
      if (linkedInData.education && Array.isArray(linkedInData.education)) {
        updateData.education = linkedInData.education;
      }
      
      if (linkedInData.skills && Array.isArray(linkedInData.skills)) {
        updateData.skills = linkedInData.skills;
      }
      
      if (linkedInData.certifications && Array.isArray(linkedInData.certifications)) {
        updateData.certifications = linkedInData.certifications;
      }
      
      if (linkedInData.profileUrl || linkedInData.linkedinUrl) {
        updateData.linkedinUrl = linkedInData.profileUrl || linkedInData.linkedinUrl;
      }

      // Update the resume data
      const result = await db
        .update(resumeData)
        .set(updateData)
        .where(eq(resumeData.id, resumeDataId))
        .returning();

      if (result.length > 0) {
        console.log(`✅ Successfully updated resume data ${resumeDataId} with LinkedIn enrichment`);
        
        // Log activity
        await db.insert(activities).values({
          type: 'resume_linkedin_update',
          message: `Resume data updated with LinkedIn enrichment from ${source}`,
          details: `Resume Data ID: ${resumeDataId}, Source: ${source}`
        });
        
        return result[0];
      }

      return null;
    } catch (error) {
      console.error('Error updating resume data with LinkedIn enrichment:', error);
      throw new Error(`Failed to update resume data with LinkedIn enrichment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
