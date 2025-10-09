import { storage } from '../storage';
export class CompanyAnalysisService {
    /**
     * Analyze the difference between resume company and LinkedIn company
     */
    static analyzeCompanyDifference(resumeCompany, linkedinCompany) {
        if (!resumeCompany && !linkedinCompany) {
            return { difference: "No company information available", score: 0 };
        }
        if (!resumeCompany) {
            return { difference: "Resume company unknown", score: 5 };
        }
        if (!linkedinCompany) {
            return { difference: "LinkedIn company unknown", score: 5 };
        }
        // Normalize company names for comparison
        const normalizedResume = this.normalizeCompanyName(resumeCompany);
        const normalizedLinkedIn = this.normalizeCompanyName(linkedinCompany);
        if (normalizedResume === normalizedLinkedIn) {
            return { difference: "Companies match", score: 10 };
        }
        // Check for partial matches (subsidiaries, abbreviations, etc.)
        if (this.isPartialMatch(normalizedResume, normalizedLinkedIn)) {
            return { difference: "Companies likely match (partial)", score: 8 };
        }
        // Check if it's a recent company change
        if (this.isRecentCompanyChange(normalizedResume, normalizedLinkedIn)) {
            return { difference: "Recent company change detected", score: 7 };
        }
        // Companies are different
        return { difference: `Different companies: ${resumeCompany} → ${linkedinCompany}`, score: 3 };
    }
    /**
     * Assess candidate hireability based on multiple factors
     */
    static assessHireability(openToWork, companyDifferenceScore, linkedinLastActive, linkedinNotes, skills, location) {
        const factors = [];
        let totalScore = 0;
        let factorCount = 0;
        // Factor 1: Open to Work status (0-10)
        const openToWorkScore = openToWork ? 10 : 3;
        totalScore += openToWorkScore;
        factorCount++;
        factors.push(`Open to Work: ${openToWorkScore}/10`);
        // Factor 2: Company difference score (0-10)
        totalScore += companyDifferenceScore;
        factorCount++;
        factors.push(`Company Consistency: ${companyDifferenceScore}/10`);
        // Factor 3: LinkedIn activity (0-10)
        let activityScore = 5; // Default score
        if (linkedinLastActive) {
            const daysSinceActive = Math.floor((Date.now() - linkedinLastActive.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceActive <= 7) {
                activityScore = 10; // Very active
                factors.push("LinkedIn: Very active (last 7 days)");
            }
            else if (daysSinceActive <= 30) {
                activityScore = 8; // Active
                factors.push("LinkedIn: Active (last 30 days)");
            }
            else if (daysSinceActive <= 90) {
                activityScore = 6; // Moderately active
                factors.push("LinkedIn: Moderately active (last 90 days)");
            }
            else {
                activityScore = 4; // Inactive
                factors.push("LinkedIn: Inactive (>90 days)");
            }
        }
        else {
            factors.push("LinkedIn: Activity unknown");
        }
        totalScore += activityScore;
        factorCount++;
        // Factor 4: Skills availability (0-10)
        const skillsScore = skills && skills.length > 0 ? Math.min(10, skills.length) : 5;
        totalScore += skillsScore;
        factorCount++;
        factors.push(`Skills: ${skillsScore}/10 (${skills?.length || 0} skills)`);
        // Factor 5: Location availability (0-10)
        const locationScore = location ? 8 : 5;
        totalScore += locationScore;
        factorCount++;
        factors.push(`Location: ${locationScore}/10`);
        // Calculate average score
        const hireabilityScore = Math.round((totalScore / factorCount) * 10) / 10;
        // Determine potential to join
        let potentialToJoin = 'Unknown';
        if (hireabilityScore >= 8) {
            potentialToJoin = 'High';
        }
        else if (hireabilityScore >= 6) {
            potentialToJoin = 'Medium';
        }
        else if (hireabilityScore >= 4) {
            potentialToJoin = 'Low';
        }
        return {
            companyDifference: this.getCompanyDifferenceDescription(companyDifferenceScore),
            companyDifferenceScore,
            hireabilityScore,
            hireabilityFactors: factors,
            potentialToJoin
        };
    }
    /**
     * Normalize company name for comparison
     */
    static normalizeCompanyName(companyName) {
        return companyName
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
    /**
     * Check if companies are partial matches
     */
    static isPartialMatch(company1, company2) {
        const words1 = company1.split(' ');
        const words2 = company2.split(' ');
        // Check if one company name contains the other
        if (company1.includes(company2) || company2.includes(company1)) {
            return true;
        }
        // Check for common words (like "Inc", "Corp", "LLC")
        const commonWords = ['inc', 'corp', 'corporation', 'llc', 'ltd', 'limited', 'company', 'co'];
        const hasCommonWords = words1.some(word => commonWords.includes(word)) ||
            words2.some(word => commonWords.includes(word));
        // Check for significant word overlap
        const commonWordsCount = words1.filter(word => words2.includes(word)).length;
        const minWords = Math.min(words1.length, words2.length);
        return hasCommonWords && commonWordsCount >= Math.ceil(minWords * 0.6);
    }
    /**
     * Check if this might be a recent company change
     */
    static isRecentCompanyChange(company1, company2) {
        // This is a simplified check - in a real system, you might have more data
        // about when the change occurred
        return company1 !== company2;
    }
    /**
     * Get human-readable description of company difference
     */
    static getCompanyDifferenceDescription(score) {
        if (score >= 9)
            return "Companies match perfectly";
        if (score >= 7)
            return "Companies likely match";
        if (score >= 5)
            return "Companies partially match";
        if (score >= 3)
            return "Companies are different";
        return "Company information unclear";
    }
    /**
     * Update candidate with company analysis and hireability assessment
     */
    static async updateCandidateAnalysis(candidateId) {
        try {
            const candidate = await storage.getCandidate(candidateId);
            if (!candidate) {
                throw new Error('Candidate not found');
            }
            // Analyze company difference
            const companyAnalysis = this.analyzeCompanyDifference(candidate.company, candidate.currentEmployer);
            // Assess hireability
            const hireabilityAnalysis = this.assessHireability(candidate.openToWork || false, companyAnalysis.score, candidate.linkedinLastActive, candidate.linkedinNotes, Array.isArray(candidate.skills) ? candidate.skills : [], candidate.location);
            // Update candidate with analysis results
            await storage.updateCandidate(candidateId, {
                companyDifference: companyAnalysis.difference,
                companyDifferenceScore: companyAnalysis.score,
                hireabilityScore: hireabilityAnalysis.hireabilityScore,
                hireabilityFactors: hireabilityAnalysis.hireabilityFactors,
                potentialToJoin: hireabilityAnalysis.potentialToJoin
            });
            console.log(`✅ Updated candidate ${candidateId} with company analysis and hireability assessment`);
        }
        catch (error) {
            console.error('Error updating candidate analysis:', error);
            throw error;
        }
    }
}
