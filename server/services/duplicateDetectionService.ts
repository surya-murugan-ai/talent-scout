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
  updateType?: string;
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
    comId: string,
    candidateId?: string
  ): Promise<ProcessCandidateResult> {
    console.log('=== DUPLICATE DETECTION SERVICE ===');
    console.log('Checking for duplicates...');
    console.log('Email:', candidateData.email);
    console.log('LinkedIn:', candidateData.linkedinUrl);
    console.log('Company ID:', comId);
    console.log('Candidate ID:', candidateId);
    
    // If candidate_id provided, update specific candidate
    if (candidateId) {
      return await this.updateSpecificCandidate(candidateData, comId, candidateId);
    }
    
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
      if (!linkedinUrl) {
        console.log('No LinkedIn URL available for re-enrichment');
      }
      let latestLinkedInData: any = null;
      let wasEnriched = false;
      
      if (linkedinUrl && typeof linkedinUrl === 'string') {
        console.log('Re-fetching latest LinkedIn data...');
        try {
          latestLinkedInData = await this.enrichFromLinkedIn(linkedinUrl);
          wasEnriched = true;
          console.log('✓ LinkedIn data refreshed successfully');
          
          // Debug: Check for invalid dates in LinkedIn data
          if (latestLinkedInData) {
            console.log('🔍 LinkedIn data keys:', Object.keys(latestLinkedInData));
            Object.keys(latestLinkedInData).forEach(key => {
              const value = latestLinkedInData[key];
              if (value instanceof Date) {
                console.log(`📅 LinkedIn Date field ${key}:`, value.toISOString());
              } else if (typeof value === 'string' && (value.includes('T') || value.includes('Z'))) {
                console.log(`📅 LinkedIn String date field ${key}:`, value);
              }
            });
          }
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
        duplicateCheck.matchedBy || 'unknown'
      );
      
      // Sanitize date values to prevent invalid timestamp errors
      const sanitizedData = this.sanitizeDates({
        ...mergedData,
        updatedAt: new Date(),
      });
      
      // Update existing candidate
      const [updatedCandidate] = await db.update(candidates)
        .set(sanitizedData)
        .where(eq(candidates.id, duplicateCheck.existingCandidate.id))
        .returning();
      
      console.log('✓ Candidate updated successfully');
      
      return {
        candidateId: updatedCandidate.id,
        isUpdate: true,
        updateType: 'duplicate_detected',
        matchedBy: duplicateCheck.matchedBy || 'unknown',
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
      
      // Sanitize date values to prevent invalid timestamp errors
      const sanitizedFinalData = this.sanitizeDates(finalData);
      
      // Debug: Log any remaining date fields that might be invalid
      console.log('🔍 Final data keys:', Object.keys(sanitizedFinalData));
      Object.keys(sanitizedFinalData).forEach(key => {
        const value = sanitizedFinalData[key];
        if (value instanceof Date) {
          console.log(`📅 Date field ${key}:`, value.toISOString());
        } else if (typeof value === 'string' && (value.includes('T') || value.includes('Z'))) {
          console.log(`📅 String date field ${key}:`, value);
        }
      });
      
      // Create new candidate
      const [newCandidate] = await db.insert(candidates)
        .values(sanitizedFinalData)
        .returning();
      
      console.log('✓ New candidate created with ID:', newCandidate.id);
      
      return {
        candidateId: newCandidate.id,
        isUpdate: false,
        updateType: 'new_candidate',
        wasEnriched,
        candidate: newCandidate,
      };
    }
  }
  
  /**
   * Update specific candidate with new resume data
   */
  private static async updateSpecificCandidate(
    candidateData: CandidateData,
    comId: string,
    candidateId: string
  ): Promise<ProcessCandidateResult> {
    
    console.log(`=== UPDATING SPECIFIC CANDIDATE: ${candidateId} ===`);
    
    // Get existing candidate
    const [existingCandidate] = await db.select()
      .from(candidates)
      .where(and(
        eq(candidates.id, candidateId),
        eq(candidates.comId, comId)
      ))
      .limit(1);
    
    if (!existingCandidate) {
      throw new Error(`Candidate ${candidateId} not found in company ${comId}`);
    }
    
    // Always re-scrape LinkedIn for latest data
    let latestLinkedInData = null;
    let wasEnriched = false;
    
    const linkedinUrl = candidateData.linkedinUrl || existingCandidate.linkedinUrl;
    if (linkedinUrl) {
      console.log('Re-scraping LinkedIn for latest data...');
      try {
        latestLinkedInData = await this.enrichFromLinkedIn(linkedinUrl);
        wasEnriched = true;
        console.log('✓ LinkedIn data refreshed successfully');
      } catch (error) {
        console.warn('⚠️ LinkedIn enrichment failed:', error instanceof Error ? error.message : 'Unknown error');
        console.log('Continuing with resume data only...');
      }
    }
    
    // Merge data with priority: Latest LinkedIn > New Resume > Existing DB
    const mergedData = {
      ...existingCandidate,           // Existing DB (lowest priority)
      ...candidateData,              // New Resume (medium priority)
      ...latestLinkedInData,         // Latest LinkedIn (highest priority)
      comId,                         // Ensure company isolation
      updatedAt: new Date()          // Update timestamp
    };
    
    // Sanitize date values to prevent invalid timestamp errors
    const sanitizedData = this.sanitizeDates(mergedData);
    
    // Debug: Log any remaining date fields that might be invalid
    console.log('🔍 Sanitized data keys:', Object.keys(sanitizedData));
    Object.keys(sanitizedData).forEach(key => {
      const value = sanitizedData[key];
      if (value instanceof Date) {
        console.log(`📅 Date field ${key}:`, value.toISOString());
      } else if (typeof value === 'string' && (value.includes('T') || value.includes('Z'))) {
        console.log(`📅 String date field ${key}:`, value);
      }
    });
    
    // Update candidate
    const [updatedCandidate] = await db.update(candidates)
      .set(sanitizedData)
      .where(eq(candidates.id, candidateId))
      .returning();
    
    console.log('✓ Candidate updated successfully');
    
    return {
      candidateId: updatedCandidate.id,
      isUpdate: true,
      updateType: 'specific_candidate',
      matchedBy: 'candidate_id',
      wasEnriched,
      changes: this.calculateChanges(existingCandidate, updatedCandidate),
      candidate: updatedCandidate
    };
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
        linkedinLastActive: profile.lastActive && profile.lastActive !== "Recently active" ? (() => {
          const date = new Date(profile.lastActive);
          return isNaN(date.getTime()) ? null : date;
        })() : null,
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
  
  /**
   * Sanitize date values to prevent invalid timestamp errors
   */
  private static sanitizeDates(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    // List of date fields that need sanitization
    const dateFields = [
      'createdAt', 'updatedAt', 'linkedinLastActive', 'enrichmentDate',
      'processingDate', 'selectionDate', 'joiningOutcome', 'eeezoUploadDate'
    ];
    
    dateFields.forEach(field => {
      if (sanitized[field] !== undefined && sanitized[field] !== null) {
        try {
          const date = new Date(sanitized[field]);
          if (isNaN(date.getTime())) {
            // Invalid date, remove it
            console.warn(`⚠️ Invalid date for field ${field}:`, sanitized[field]);
            delete sanitized[field];
          } else {
            sanitized[field] = date;
          }
        } catch (error) {
          console.warn(`⚠️ Error processing date field ${field}:`, error);
          delete sanitized[field];
        }
      }
    });
    
    // Sanitize nested objects (like enrichedData)
    if (sanitized.enrichedData && typeof sanitized.enrichedData === 'object') {
      try {
        sanitized.enrichedData = this.sanitizeDates(sanitized.enrichedData);
      } catch (error) {
        console.warn('⚠️ Error sanitizing enrichedData:', error);
        // Keep the original enrichedData if sanitization fails
      }
    }
    
    // Sanitize arrays that might contain date objects
    Object.keys(sanitized).forEach(key => {
      if (Array.isArray(sanitized[key])) {
        try {
          sanitized[key] = sanitized[key].map(item => 
            typeof item === 'object' && item !== null ? this.sanitizeDates(item) : item
          );
        } catch (error) {
          console.warn(`⚠️ Error sanitizing array field ${key}:`, error);
          // Keep the original array if sanitization fails
        }
      }
    });
    
    // Remove any fields that might contain invalid dates by checking all string values
    Object.keys(sanitized).forEach(key => {
      const value = sanitized[key];
      if (typeof value === 'string' && (value.includes('T') || value.includes('Z'))) {
        try {
          // This looks like a date string, validate it
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            // Invalid date string, remove it
            console.warn(`⚠️ Invalid date string for field ${key}:`, value);
            delete sanitized[key];
          }
        } catch (error) {
          console.warn(`⚠️ Error validating date string for field ${key}:`, error);
          delete sanitized[key];
        }
      }
    });
    
    return sanitized;
  }

  /**
   * Calculate what changed between old and new data
   */
  private static calculateChanges(oldData: any, newData: any): any {
    const changes: any = {};
    
    // Track key field changes
    const fieldsToTrack = [
      'name', 'email', 'phone', 'title', 'company', 
      'linkedinUrl', 'currentCompany', 'currentTitle',
      'linkedinHeadline', 'linkedinConnections'
    ];
    
    fieldsToTrack.forEach(field => {
      if (oldData[field] !== newData[field]) {
        changes[field] = {
          old: oldData[field],
          new: newData[field]
        };
      }
    });
    
    return changes;
  }
}

