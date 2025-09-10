/**
 * Individual Scoring Service
 * 
 * Calculates individual scores for each scoring component:
 * 1. Open to Work Score (0-10)
 * 2. Job Stability Score (0-10) 
 * 3. Platform Engagement Score (0-10)
 * 4. Skill Match Score (0-10) - placeholder for future implementation
 */

import { JobStabilityService } from './jobStabilityService';

interface CandidateData {
  // Basic info
  name?: string;
  email?: string;
  summary?: string;
  
  // LinkedIn data
  openToWork?: boolean;
  linkedinLastActive?: Date | string;
  linkedinConnections?: number;
  linkedinNotes?: string;
  linkedinSummary?: string;
  
  // Experience data
  experience?: Array<{
    title: string;
    company: string;
    startDate?: string;
    endDate?: string | null;
    duration?: string;
    description?: string;
  }>;
  
  // Skills data
  skills?: Array<{
    title: string;
    subComponents?: any[];
  }>;
}

interface IndividualScores {
  openToWorkScore: number; // 0-10
  jobStabilityScore: number; // 0-10
  platformEngagementScore: number; // 0-10
  skillMatchScore: number; // 0-10 (placeholder)
}

export class IndividualScoringService {
  
  /**
   * Calculate all individual scores for a candidate
   */
  static calculateIndividualScores(candidateData: CandidateData): IndividualScores {
    return {
      openToWorkScore: this.calculateOpenToWorkScore(candidateData),
      jobStabilityScore: this.calculateJobStabilityScore(candidateData),
      platformEngagementScore: this.calculatePlatformEngagementScore(candidateData),
      skillMatchScore: 0 // Placeholder - will be updated later against specific JDs
    };
  }

  /**
   * Calculate Open to Work Score (0-10)
   * 
   * Logic:
   * 1. Check LinkedIn openToWork field (if true -> 10)
   * 2. Check profile summary for keywords like "immediate joiner", "open for opportunity"
   * 3. Return scaled score
   */
  static calculateOpenToWorkScore(candidateData: CandidateData): number {
    // Priority 1: LinkedIn openToWork flag
    if (candidateData.openToWork === true) {
      return 10;
    }
    
    // Priority 2: Check summary and LinkedIn summary for keywords
    const summaryText = [
      candidateData.summary || '',
      candidateData.linkedinSummary || ''
    ].join(' ').toLowerCase();

    const openToWorkKeywords = [
      'immediate joiner',
      'immediately available',
      'open for opportunity', 
      'open to opportunity',
      'seeking new opportunity',
      'looking for new',
      'open to work',
      'available immediately',
      'ready to join',
      'actively seeking',
      'job seeking',
      'career change',
      'new opportunities',
      'open for roles',
      'exploring opportunities'
    ];

    const urgentKeywords = [
      'immediate',
      'asap',
      'urgent',
      'available now',
      'right away'
    ];

    const passiveKeywords = [
      'open to discuss',
      'interested in hearing',
      'would consider',
      'might be interested'
    ];

    // Check for keywords
    let score = 0;
    let keywordMatches = 0;

    // High priority keywords
    for (const keyword of openToWorkKeywords) {
      if (summaryText.includes(keyword)) {
        keywordMatches++;
        score += 2;
      }
    }

    // Urgent keywords (bonus)
    for (const keyword of urgentKeywords) {
      if (summaryText.includes(keyword)) {
        score += 1;
      }
    }

    // Passive keywords (lower score)
    for (const keyword of passiveKeywords) {
      if (summaryText.includes(keyword)) {
        score += 0.5;
      }
    }

    // Cap the score and scale to 0-10
    const finalScore = Math.min(10, score);
    
    // If no explicit indicators, return a neutral score
    if (keywordMatches === 0 && candidateData.openToWork !== true) {
      return 5; // Neutral - no clear indication either way
    }

    return Math.round(finalScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate Job Stability Score (0-10)
   * 
   * Uses the detailed JobStabilityService algorithm
   */
  static calculateJobStabilityScore(candidateData: CandidateData): number {
    if (!candidateData.experience || candidateData.experience.length === 0) {
      return 0; // No experience data
    }

    const stabilityScoring = JobStabilityService.calculateJobStabilityScore(candidateData.experience);
    return stabilityScoring.scaledScore;
  }

  /**
   * Calculate Platform Engagement Score (0-10)
   * 
   * Based on LinkedIn activity and engagement indicators
   */
  static calculatePlatformEngagementScore(candidateData: CandidateData): number {
    let score = 0;
    let factors = 0;

    // Factor 1: LinkedIn Last Active (40% weight)
    if (candidateData.linkedinLastActive) {
      const lastActive = new Date(candidateData.linkedinLastActive);
      const daysSinceActive = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
      
      let activityScore = 0;
      if (daysSinceActive <= 7) {
        activityScore = 10; // Very active
      } else if (daysSinceActive <= 30) {
        activityScore = 8; // Active
      } else if (daysSinceActive <= 90) {
        activityScore = 6; // Moderately active
      } else if (daysSinceActive <= 180) {
        activityScore = 4; // Less active
      } else {
        activityScore = 2; // Inactive
      }
      
      score += activityScore * 0.4;
      factors++;
    }

    // Factor 2: LinkedIn Connections (20% weight)
    if (candidateData.linkedinConnections) {
      let connectionScore = 0;
      if (candidateData.linkedinConnections >= 500) {
        connectionScore = 10; // Well connected
      } else if (candidateData.linkedinConnections >= 200) {
        connectionScore = 8; // Good network
      } else if (candidateData.linkedinConnections >= 100) {
        connectionScore = 6; // Moderate network
      } else if (candidateData.linkedinConnections >= 50) {
        connectionScore = 4; // Small network
      } else {
        connectionScore = 2; // Limited network
      }
      
      score += connectionScore * 0.2;
      factors++;
    }

    // Factor 3: LinkedIn Notes/Activity (20% weight)
    if (candidateData.linkedinNotes) {
      const notesLength = candidateData.linkedinNotes.length;
      let notesScore = 0;
      
      if (notesLength > 500) {
        notesScore = 10; // Very active in posts/comments
      } else if (notesLength > 200) {
        notesScore = 8; // Active
      } else if (notesLength > 100) {
        notesScore = 6; // Moderate
      } else if (notesLength > 0) {
        notesScore = 4; // Some activity
      } else {
        notesScore = 2; // Minimal activity
      }
      
      score += notesScore * 0.2;
      factors++;
    }

    // Factor 4: Profile Completeness (20% weight)
    let completenessScore = 0;
    let completenessFactors = 0;

    if (candidateData.linkedinSummary && candidateData.linkedinSummary.length > 50) {
      completenessScore += 3;
      completenessFactors++;
    }
    
    if (candidateData.experience && candidateData.experience.length > 0) {
      completenessScore += 3;
      completenessFactors++;
    }
    
    if (candidateData.skills && candidateData.skills.length > 0) {
      completenessScore += 2;
      completenessFactors++;
    }
    
    if (candidateData.email) {
      completenessScore += 2;
      completenessFactors++;
    }

    if (completenessFactors > 0) {
      score += (completenessScore / completenessFactors) * 2 * 0.2; // Normalize and apply weight
      factors++;
    }

    // Calculate final score
    if (factors === 0) {
      return 5; // Default neutral score if no data
    }

    const finalScore = Math.min(10, score);
    return Math.round(finalScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate Skill Match Score (0-10)
   * 
   * Placeholder implementation - will be enhanced later for JD-specific matching
   */
  static calculateSkillMatchScore(candidateData: CandidateData, jobDescription?: string): number {
    // Placeholder implementation
    if (!candidateData.skills || candidateData.skills.length === 0) {
      return 0;
    }

    // Basic skill count scoring for now
    const skillCount = candidateData.skills.length;
    if (skillCount >= 20) return 10;
    if (skillCount >= 15) return 8;
    if (skillCount >= 10) return 6;
    if (skillCount >= 5) return 4;
    if (skillCount >= 1) return 2;
    return 0;
  }

  /**
   * Validate score range (ensure 0-10)
   */
  private static validateScore(score: number): number {
    return Math.max(0, Math.min(10, score));
  }
}
