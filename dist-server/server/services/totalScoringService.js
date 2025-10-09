/**
 * Total Scoring Service
 *
 * Handles calculation of total weighted scores based on company scoring configuration
 * and individual component scores
 */
import { storage } from '../storage.js';
export class TotalScoringService {
    /**
     * Calculate total weighted score based on individual scores and company weights
     */
    static calculateTotalScore(individualScores, weights) {
        // Ensure weights sum to 100 (normalize if needed)
        const totalWeight = weights.openToWork + weights.skillMatch + weights.jobStability + weights.platformEngagement;
        if (totalWeight === 0) {
            return 0; // Avoid division by zero
        }
        // Normalize weights to ensure they sum to 1.0
        const normalizedWeights = {
            openToWork: weights.openToWork / totalWeight,
            skillMatch: weights.skillMatch / totalWeight,
            jobStability: weights.jobStability / totalWeight,
            platformEngagement: weights.platformEngagement / totalWeight
        };
        // Calculate weighted score (0-10 scale)
        const totalScore = (individualScores.openToWorkScore * normalizedWeights.openToWork) +
            (individualScores.skillMatchScore * normalizedWeights.skillMatch) +
            (individualScores.jobStabilityScore * normalizedWeights.jobStability) +
            (individualScores.platformEngagementScore * normalizedWeights.platformEngagement);
        // Round to 2 decimal places
        return Math.round(totalScore * 100) / 100;
    }
    /**
     * Get default scoring weights if no company configuration exists
     */
    static getDefaultWeights() {
        return {
            openToWork: 25,
            skillMatch: 25,
            jobStability: 25,
            platformEngagement: 25
        };
    }
    /**
     * Calculate priority level based on total score
     */
    static calculatePriority(totalScore) {
        if (totalScore >= 7.5)
            return 'High';
        if (totalScore >= 5.0)
            return 'Medium';
        return 'Low';
    }
    /**
     * Update candidate with new skill match score and recalculate total score
     */
    static async updateCandidateSkillMatchAndTotal(candidateId, comId, skillMatchScore, jobDescription) {
        try {
            // Validate skill match score
            if (skillMatchScore < 0 || skillMatchScore > 10) {
                throw new Error('Skill match score must be between 0 and 10');
            }
            // Get current candidate data
            const candidate = await storage.getCandidate(candidateId, comId);
            if (!candidate) {
                throw new Error('Candidate not found or does not belong to this company');
            }
            // Get company scoring configuration
            let scoringConfig = await storage.getScoringConfig(comId);
            const weights = scoringConfig ? {
                openToWork: scoringConfig.openToWork || 25,
                skillMatch: scoringConfig.skillMatch || 25,
                jobStability: scoringConfig.jobStability || 25,
                platformEngagement: scoringConfig.platformEngagement || 25
            } : this.getDefaultWeights();
            // Get current individual scores
            const individualScores = {
                openToWorkScore: candidate.openToWorkScore || 0,
                skillMatchScore: skillMatchScore, // New skill match score
                jobStabilityScore: candidate.jobStabilityScore || 0,
                platformEngagementScore: candidate.platformEngagementScore || 0
            };
            // Calculate new total score
            const totalScore = this.calculateTotalScore(individualScores, weights);
            const priority = this.calculatePriority(totalScore);
            // Update candidate with new scores
            const updatedCandidate = await storage.updateCandidate(candidateId, {
                skillMatchScore: skillMatchScore,
                score: totalScore,
                priority: priority,
                hireabilityScore: totalScore, // Use total score as hireability score
                potentialToJoin: priority
            }, comId);
            if (!updatedCandidate) {
                throw new Error('Failed to update candidate');
            }
            console.log(`✅ Updated candidate ${candidateId} scores:`, {
                skillMatch: skillMatchScore,
                total: totalScore,
                priority: priority,
                weights: weights
            });
            return {
                success: true,
                candidateId,
                skillMatchScore,
                totalScore,
                priority,
                weights
            };
        }
        catch (error) {
            console.error('Error updating candidate skill match and total score:', error);
            throw error;
        }
    }
    /**
     * Recalculate total scores for all candidates in a company after scoring config changes
     */
    static async recalculateAllCandidateScores(comId) {
        try {
            // Get company scoring configuration
            let scoringConfig = await storage.getScoringConfig(comId);
            const weights = scoringConfig ? {
                openToWork: scoringConfig.openToWork || 25,
                skillMatch: scoringConfig.skillMatch || 25,
                jobStability: scoringConfig.jobStability || 25,
                platformEngagement: scoringConfig.platformEngagement || 25
            } : this.getDefaultWeights();
            // Get all active candidates for the company
            const candidates = await storage.getCandidates(comId, 1000, 0); // Get up to 1000 candidates
            let updatedCount = 0;
            for (const candidate of candidates) {
                try {
                    const individualScores = {
                        openToWorkScore: candidate.openToWorkScore || 0,
                        skillMatchScore: candidate.skillMatchScore || 0,
                        jobStabilityScore: candidate.jobStabilityScore || 0,
                        platformEngagementScore: candidate.platformEngagementScore || 0
                    };
                    // Calculate new total score
                    const totalScore = this.calculateTotalScore(individualScores, weights);
                    const priority = this.calculatePriority(totalScore);
                    // Update candidate
                    await storage.updateCandidate(candidate.id, {
                        score: totalScore,
                        priority: priority,
                        hireabilityScore: totalScore,
                        potentialToJoin: priority
                    }, comId);
                    updatedCount++;
                }
                catch (candidateError) {
                    console.warn(`Failed to update candidate ${candidate.id}:`, candidateError);
                }
            }
            console.log(`✅ Recalculated scores for ${updatedCount} candidates in company ${comId}`);
            return {
                success: true,
                updatedCount,
                weights
            };
        }
        catch (error) {
            console.error('Error recalculating candidate scores:', error);
            throw error;
        }
    }
}
