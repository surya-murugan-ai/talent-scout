import { db } from '../db.js';
import { candidates } from '../../shared/schema.js';
import { eq, and, or, isNotNull } from 'drizzle-orm';
import { linkedInService } from './linkedin.js';

interface CandidateData {
  email?: string | null;
  linkedinUrl?: string | null;
  [key: string]: any;
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingCandidate?: any;
  matchedBy?: 'email_and_linkedin' | 'email' | 'linkedin';
  requiresUpdate?: boolean;
  changes?: {
    email?: { old: string | null, new: string | null };
    linkedinUrl?: { old: string | null, new: string | null };
  };
}

interface ProcessCandidateResult {
  candidateId: string;
  isUpdate: boolean;
  matchedBy?: string;
  changes?: any;
  wasEnriched: boolean;
  candidate: any;
}

export class DuplicateDetectionService {
  
  /**
   * Main entry point: Check for duplicates and process candidate
   * Automatically re-enriches from LinkedIn if duplicate is found
   */
  static async checkAndProcessCandidate(
    candidateData: CandidateData,
    comId: string
  ): Promise<ProcessCandidateResult> {
    console.log('=== DUPLICATE DETECTION SERVICE ===');
    console.log('Checking for duplicates...');
    console.log('Email:', candidateData.email);
    console.log('LinkedIn:', candidateData.linkedinUrl);
    console.log('Company ID:', comId);
    
    // Check for duplicate
    const duplicateCheck = await this.findDuplicate(
      candidateData.email,
      candidateData.linkedinUrl,
      comId
    );
    
    if (duplicateCheck.isDuplicate && duplicateCheck.existingCandidate) {
      console.log('✓ Duplicate found! Match type:', duplicateCheck.matchedBy);
      console.log('Existing candidate ID:', duplicateCheck.existingCandidate.id);
      
      // Re-fetch latest LinkedIn data
      const linkedinUrl = candidateData.linkedinUrl || duplicateCheck.existingCandidate.linkedinUrl;
      let latestLinkedInData = null;
      let wasEnriched = false;
      
      if (linkedinUrl && typeof linkedinUrl === 'string') {
        console.log('Re-fetching latest LinkedIn data...');
        try {
          latestLinkedInData = await this.enrichFromLinkedIn(linkedinUrl);
          wasEnriched = true;
          console.log('✓ LinkedIn data refreshed successfully');
        } catch (error) {
          console.warn('⚠️  LinkedIn enrichment failed:', error instanceof Error ? error.message : 'Unknown error');
          console.log('Continuing with resume data only...');
        }
      }
      
      // Handle edge cases and merge data
      const mergedData = await this.handleDuplicateUpdate(
        duplicateCheck.existingCandidate,
        candidateData,
        latestLinkedInData,
        duplicateCheck.matchedBy
      );
      
      // Update existing candidate
      const [updatedCandidate] = await db.update(candidates)
        .set({
          ...mergedData,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, duplicateCheck.existingCandidate.id))
        .returning();
      
      console.log('✓ Candidate updated successfully');
      
      return {
        candidateId: updatedCandidate.id,
        isUpdate: true,
        matchedBy: duplicateCheck.matchedBy,
        changes: duplicateCheck.changes,
        wasEnriched,
        candidate: updatedCandidate,
      };
    } else {
      console.log('✗ No duplicate found - creating new candidate');
      
      // New candidate - optionally enrich from LinkedIn before creating
      let linkedInData = null;
      let wasEnriched = false;
      
      if (candidateData.linkedinUrl) {
        console.log('Enriching new candidate from LinkedIn...');
        try {
          linkedInData = await this.enrichFromLinkedIn(candidateData.linkedinUrl);
          wasEnriched = true;
          console.log('✓ LinkedIn data fetched for new candidate');
        } catch (error) {
          console.warn('⚠️  LinkedIn enrichment failed:', error instanceof Error ? error.message : 'Unknown error');
          console.log('Creating candidate with resume data only...');
        }
      }
      
      // Merge LinkedIn data with candidate data
      const finalData = {
        ...candidateData,
        ...linkedInData,
        comId,
        createdAt: new Date(),
      };
      
      // Create new candidate
      const [newCandidate] = await db.insert(candidates)
        .values(finalData)
        .returning();
      
      console.log('✓ New candidate created with ID:', newCandidate.id);
      
      return {
        candidateId: newCandidate.id,
        isUpdate: false,
        wasEnriched,
        candidate: newCandidate,
      };
    }
  }
  
  /**
   * Find duplicate candidate by email and/or LinkedIn URL
   * Handles edge cases where one identifier changed
   */
  private static async findDuplicate(
    email: string | null | undefined,
    linkedinUrl: string | null | undefined,
    comId: string
  ): Promise<DuplicateCheckResult> {
    
    // Normalize inputs
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedLinkedIn = linkedinUrl?.trim();
    
    if (!normalizedEmail && !normalizedLinkedIn) {
      return { isDuplicate: false };
    }
    
    // 1. Try exact match (both email AND LinkedIn)
    if (normalizedEmail && normalizedLinkedIn) {
      const exactMatch = await db.select()
        .from(candidates)
        .where(
          and(
            eq(candidates.comId, comId),
            eq(candidates.email, normalizedEmail),
            eq(candidates.linkedinUrl, normalizedLinkedIn)
          )
        )
        .limit(1);
      
      if (exactMatch.length > 0) {
        return {
          isDuplicate: true,
          existingCandidate: exactMatch[0],
          matchedBy: 'email_and_linkedin',
          requiresUpdate: false,
        };
      }
    }
    
    // 2. Try email-only match (LinkedIn URL might have changed)
    if (normalizedEmail) {
      const emailMatch = await db.select()
        .from(candidates)
        .where(
          and(
            eq(candidates.comId, comId),
            eq(candidates.email, normalizedEmail)
          )
        )
        .limit(1);
      
      if (emailMatch.length > 0) {
        const existing = emailMatch[0];
        const changes: any = {};
        
        // Check if LinkedIn URL changed
        if (normalizedLinkedIn && existing.linkedinUrl !== normalizedLinkedIn) {
          changes.linkedinUrl = {
            old: existing.linkedinUrl,
            new: normalizedLinkedIn,
          };
        }
        
        return {
          isDuplicate: true,
          existingCandidate: existing,
          matchedBy: 'email',
          requiresUpdate: true,
          changes: Object.keys(changes).length > 0 ? changes : undefined,
        };
      }
    }
    
    // 3. Try LinkedIn-only match (email might have changed)
    if (normalizedLinkedIn) {
      const linkedInMatch = await db.select()
        .from(candidates)
        .where(
          and(
            eq(candidates.comId, comId),
            eq(candidates.linkedinUrl, normalizedLinkedIn)
          )
        )
        .limit(1);
      
      if (linkedInMatch.length > 0) {
        const existing = linkedInMatch[0];
        const changes: any = {};
        
        // Check if email changed
        if (normalizedEmail && existing.email !== normalizedEmail) {
          changes.email = {
            old: existing.email,
            new: normalizedEmail,
          };
        }
        
        return {
          isDuplicate: true,
          existingCandidate: existing,
          matchedBy: 'linkedin',
          requiresUpdate: true,
          changes: Object.keys(changes).length > 0 ? changes : undefined,
        };
      }
    }
    
    // No duplicate found
    return { isDuplicate: false };
  }
  
  /**
   * Handle duplicate update - merge existing, new resume, and latest LinkedIn data
   * Priority: LinkedIn (latest) > Resume (uploaded) > Database (existing)
   */
  private static async handleDuplicateUpdate(
    existingCandidate: any,
    newResumeData: CandidateData,
    latestLinkedInData: any | null,
    matchType: string
  ): Promise<any> {
    
    const changes: any = {};
    
    // Handle email change (if matched by LinkedIn only)
    let primaryEmail = existingCandidate.email;
    let alternateEmail = existingCandidate.alternateEmail;
    
    if (matchType === 'linkedin' && newResumeData.email && newResumeData.email !== existingCandidate.email) {
      console.log('Email changed detected:');
      console.log('  Old:', existingCandidate.email);
      console.log('  New:', newResumeData.email);
      
      // Move current email to alternate
      alternateEmail = existingCandidate.email;
      primaryEmail = newResumeData.email;
      
      changes.email = {
        from: existingCandidate.email,
        to: newResumeData.email,
        alternateEmail: alternateEmail,
      };
    }
    
    // Handle LinkedIn URL change (if matched by email only)
    let linkedinUrl = existingCandidate.linkedinUrl;
    
    if (matchType === 'email' && newResumeData.linkedinUrl && newResumeData.linkedinUrl !== existingCandidate.linkedinUrl) {
      console.log('LinkedIn URL changed detected:');
      console.log('  Old:', existingCandidate.linkedinUrl);
      console.log('  New:', newResumeData.linkedinUrl);
      
      linkedinUrl = newResumeData.linkedinUrl;
      
      changes.linkedinUrl = {
        from: existingCandidate.linkedinUrl,
        to: newResumeData.linkedinUrl,
      };
    }
    
    // Merge data with priority: LinkedIn > Resume > Existing
    const mergedData = {
      // Start with existing data (lowest priority)
      ...existingCandidate,
      
      // Override with new resume data (medium priority)
      ...newResumeData,
      
      // Override with latest LinkedIn data (highest priority)
      ...(latestLinkedInData || {}),
      
      // Apply edge case changes
      email: primaryEmail,
      alternateEmail: alternateEmail,
      linkedinUrl: linkedinUrl,
      
      // Preserve company ID
      comId: existingCandidate.comId,
      
      // Update metadata
      lastEnriched: latestLinkedInData ? new Date() : existingCandidate.lastEnriched,
      enrichmentStatus: latestLinkedInData ? 'completed' : existingCandidate.enrichmentStatus,
      eeezoStatus: 'updated',
      
      // Merge arrays intelligently
      skills: this.mergeArrays(
        existingCandidate.skills,
        newResumeData.skills,
        latestLinkedInData?.skills
      ),
      
      experience: newResumeData.experience || existingCandidate.experience,
      education: newResumeData.education || existingCandidate.education,
      certifications: this.mergeArrays(
        existingCandidate.certifications,
        newResumeData.certifications,
        latestLinkedInData?.certifications
      ),
    };
    
    if (Object.keys(changes).length > 0) {
      console.log('Changes applied:', changes);
    }
    
    return mergedData;
  }
  
  /**
   * Enrich candidate from LinkedIn using existing service
   */
  private static async enrichFromLinkedIn(linkedinUrl: string): Promise<any | null> {
    try {
      // Use existing LinkedIn service to fetch profile
      const profile = await linkedInService.enrichProfile(linkedinUrl);
      
      if (!profile) {
        return null;
      }
      
      // Map LinkedIn profile to candidate fields
      return {
        // LinkedIn-specific fields
        linkedinHeadline: profile.headline,
        linkedinSummary: profile.summary,
        linkedinConnections: profile.connections,
        linkedinLastActive: profile.lastActive ? new Date(profile.lastActive) : null,
        linkedinNotes: profile.recentActivity?.join('\n'),
        
        // Update basic fields with LinkedIn data
        currentCompany: profile.currentCompany || profile.company,
        currentTitle: profile.currentPosition || profile.title,
        currentEmployer: profile.currentCompany,
        location: profile.location,
        
        // Open to work status
        openToWork: profile.openToWork || false,
        
        // Skills from LinkedIn (will be merged)
        skills: profile.skills || [],
        
        // Experience and education
        experience: profile.experience || [],
        education: profile.education || [],
        
        // Metadata
        enrichmentStatus: 'completed',
        dataSource: 'linkedin',
      };
    } catch (error) {
      console.error('LinkedIn enrichment error:', error);
      throw error;
    }
  }
  
  /**
   * Merge multiple arrays, removing duplicates
   */
  private static mergeArrays(...arrays: any[][]): any[] {
    const merged = new Set<string>();
    
    for (const arr of arrays) {
      if (Array.isArray(arr)) {
        arr.forEach(item => {
          if (typeof item === 'string') {
            merged.add(item);
          } else if (typeof item === 'object' && item !== null) {
            merged.add(JSON.stringify(item));
          }
        });
      }
    }
    
    return Array.from(merged).map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    });
  }
  
  /**
   * Find candidate by email only
   */
  static async findByEmail(email: string, comId: string): Promise<any | null> {
    const normalized = email.trim().toLowerCase();
    const result = await db.select()
      .from(candidates)
      .where(
        and(
          eq(candidates.comId, comId),
          eq(candidates.email, normalized)
        )
      )
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  }
  
  /**
   * Find candidate by LinkedIn URL only
   */
  static async findByLinkedIn(linkedinUrl: string, comId: string): Promise<any | null> {
    const normalized = linkedinUrl.trim();
    const result = await db.select()
      .from(candidates)
      .where(
        and(
          eq(candidates.comId, comId),
          eq(candidates.linkedinUrl, normalized)
        )
      )
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  }
  
  /**
   * Find candidate by both email and LinkedIn
   */
  static async findByEmailAndLinkedIn(
    email: string,
    linkedinUrl: string,
    comId: string
  ): Promise<any | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedLinkedIn = linkedinUrl.trim();
    
    const result = await db.select()
      .from(candidates)
      .where(
        and(
          eq(candidates.comId, comId),
          eq(candidates.email, normalizedEmail),
          eq(candidates.linkedinUrl, normalizedLinkedIn)
        )
      )
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  }
}

