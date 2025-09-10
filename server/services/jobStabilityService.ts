/**
 * Job Stability Scoring Service
 * 
 * Calculates job stability score based on employment history analysis
 * Score range: 0-10
 */

interface ExperienceEntry {
  title: string;
  company: string;
  startDate?: string;
  endDate?: string | null;
  duration?: string;
  description?: string;
}

interface JobStabilityMetrics {
  avgTenure: number; // months
  longestTenure: number; // months
  jobChangesLast5Years: number;
  largestGap: number; // months
  continuityScore: number; // 0-100
}

interface JobStabilityScoring {
  avgTenureScore: number; // 0-100
  longestTenureScore: number; // 0-100
  jobChangeScore: number; // 0-100
  gapScore: number; // 0-100
  continuityScore: number; // 0-100
  finalScore: number; // 0-100
  scaledScore: number; // 0-10
}

export class JobStabilityService {
  
  /**
   * Calculate job stability score for a candidate
   */
  static calculateJobStabilityScore(experience: ExperienceEntry[]): JobStabilityScoring {
    if (!experience || experience.length === 0) {
      return {
        avgTenureScore: 0,
        longestTenureScore: 0,
        jobChangeScore: 0,
        gapScore: 100, // No gaps if no jobs
        continuityScore: 0,
        finalScore: 0,
        scaledScore: 0
      };
    }

    const metrics = this.calculateMetrics(experience);
    
    // Calculate individual scores (0-100 scale)
    const avgTenureScore = this.scoreAverageTenure(metrics.avgTenure);
    const longestTenureScore = this.scoreLongestTenure(metrics.longestTenure);
    const jobChangeScore = this.scoreJobChanges(metrics.jobChangesLast5Years);
    const gapScore = this.scoreGaps(metrics.largestGap);
    const continuityScore = metrics.continuityScore;

    // Weighted final score
    const finalScore = 
      0.30 * avgTenureScore +
      0.20 * longestTenureScore +
      0.25 * jobChangeScore +
      0.15 * gapScore +
      0.10 * continuityScore;

    // Scale to 0-10
    const scaledScore = Math.round((finalScore / 100) * 10 * 100) / 100; // Round to 2 decimal places

    return {
      avgTenureScore,
      longestTenureScore,
      jobChangeScore,
      gapScore,
      continuityScore,
      finalScore: Math.round(finalScore),
      scaledScore
    };
  }

  /**
   * Calculate job stability metrics from experience data
   */
  private static calculateMetrics(experience: ExperienceEntry[]): JobStabilityMetrics {
    const jobs = this.parseExperienceData(experience);
    
    // Calculate tenure for each job
    const tenures = jobs.map(job => this.calculateTenureMonths(job.startDate, job.endDate));
    
    // Average tenure (last 2 jobs)
    const recentTenures = tenures.slice(0, 2);
    const avgTenure = recentTenures.length > 0 ? 
      recentTenures.reduce((sum, tenure) => sum + tenure, 0) / recentTenures.length : 0;

    // Longest tenure
    const longestTenure = Math.max(...tenures, 0);

    // Job changes in last 5 years
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const recentJobs = jobs.filter(job => 
      job.startDate && new Date(job.startDate) >= fiveYearsAgo
    );
    const jobChangesLast5Years = Math.max(0, recentJobs.length - 1);

    // Calculate gaps
    const largestGap = this.calculateLargestGap(jobs);

    // Continuity score
    const continuityScore = this.calculateContinuityScore(jobs);

    return {
      avgTenure,
      longestTenure,
      jobChangesLast5Years,
      largestGap,
      continuityScore
    };
  }

  /**
   * Parse and normalize experience data
   */
  private static parseExperienceData(experience: ExperienceEntry[]): Array<{
    title: string;
    company: string;
    startDate: Date | null;
    endDate: Date | null;
  }> {
    return experience.map(exp => ({
      title: exp.title || '',
      company: exp.company || '',
      startDate: this.parseDate(exp.startDate),
      endDate: this.parseDate(exp.endDate)
    })).filter(job => job.startDate !== null); // Only include jobs with valid start dates
  }

  /**
   * Parse date string to Date object
   */
  private static parseDate(dateStr?: string | null): Date | null {
    if (!dateStr || dateStr.toLowerCase() === 'current' || dateStr.toLowerCase() === 'present') {
      return dateStr?.toLowerCase() === 'current' || dateStr?.toLowerCase() === 'present' ? new Date() : null;
    }

    try {
      // Handle various date formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }

      // Try parsing MM/YYYY or MM-YYYY format
      const monthYearMatch = dateStr.match(/(\d{1,2})[\/\-](\d{4})/);
      if (monthYearMatch) {
        const [, month, year] = monthYearMatch;
        return new Date(parseInt(year), parseInt(month) - 1);
      }

      // Try parsing YYYY format
      const yearMatch = dateStr.match(/(\d{4})/);
      if (yearMatch) {
        return new Date(parseInt(yearMatch[1]), 0);
      }

      return null;
    } catch (error) {
      console.warn('Failed to parse date:', dateStr, error);
      return null;
    }
  }

  /**
   * Calculate tenure in months between two dates
   */
  private static calculateTenureMonths(startDate: Date | null, endDate: Date | null): number {
    if (!startDate) return 0;
    
    const end = endDate || new Date(); // Use current date if job is ongoing
    const diffTime = Math.abs(end.getTime() - startDate.getTime());
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // Average month length
    
    return diffMonths;
  }

  /**
   * Calculate largest employment gap in months
   */
  private static calculateLargestGap(jobs: Array<{startDate: Date | null; endDate: Date | null}>): number {
    if (jobs.length < 2) return 0;

    // Sort jobs by start date
    const sortedJobs = jobs
      .filter(job => job.startDate)
      .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());

    let largestGap = 0;

    for (let i = 1; i < sortedJobs.length; i++) {
      const prevJob = sortedJobs[i - 1];
      const currentJob = sortedJobs[i];

      if (prevJob.endDate && currentJob.startDate) {
        const gapTime = currentJob.startDate.getTime() - prevJob.endDate.getTime();
        const gapMonths = Math.ceil(gapTime / (1000 * 60 * 60 * 24 * 30.44));
        
        if (gapMonths > 2) { // Only consider gaps > 2 months
          largestGap = Math.max(largestGap, gapMonths);
        }
      }
    }

    return largestGap;
  }

  /**
   * Calculate continuity score based on industry/function consistency
   */
  private static calculateContinuityScore(jobs: Array<{title: string; company: string}>): number {
    if (jobs.length <= 1) return 100;

    // Simple keyword-based continuity analysis
    const techKeywords = ['software', 'developer', 'engineer', 'programmer', 'architect', 'tech', 'data', 'web', 'mobile', 'frontend', 'backend', 'fullstack', 'devops'];
    const managementKeywords = ['manager', 'director', 'lead', 'head', 'chief', 'vp', 'president', 'senior'];
    const designKeywords = ['designer', 'ux', 'ui', 'product', 'creative', 'visual'];
    const salesKeywords = ['sales', 'account', 'business', 'marketing', 'customer'];

    const categories = [techKeywords, managementKeywords, designKeywords, salesKeywords];
    
    let bestCategoryScore = 0;

    for (const category of categories) {
      let matchingJobs = 0;
      
      for (const job of jobs) {
        const titleLower = job.title.toLowerCase();
        if (category.some(keyword => titleLower.includes(keyword))) {
          matchingJobs++;
        }
      }

      const categoryScore = (matchingJobs / jobs.length) * 100;
      bestCategoryScore = Math.max(bestCategoryScore, categoryScore);
    }

    // Score based on consistency
    if (bestCategoryScore >= 70) return 100;
    if (bestCategoryScore >= 50) return 70;
    if (bestCategoryScore >= 30) return 40;
    return 20;
  }

  /**
   * Score average tenure (last 2 jobs)
   */
  private static scoreAverageTenure(avgTenure: number): number {
    if (avgTenure >= 24) return 100;
    if (avgTenure >= 18) return 75;
    if (avgTenure >= 12) return 50;
    if (avgTenure >= 6) return 25;
    return 0;
  }

  /**
   * Score longest tenure
   */
  private static scoreLongestTenure(longestTenure: number): number {
    if (longestTenure >= 60) return 100; // 5+ years
    if (longestTenure >= 36) return 80;  // 3-5 years
    if (longestTenure >= 24) return 60;  // 2-3 years
    if (longestTenure >= 12) return 40;  // 1-2 years
    return 20;
  }

  /**
   * Score job changes in last 5 years
   */
  private static scoreJobChanges(changes: number): number {
    if (changes <= 1) return 100;
    if (changes === 2) return 80;
    if (changes === 3) return 60;
    if (changes === 4) return 40;
    return 20; // 5+ changes
  }

  /**
   * Score employment gaps
   */
  private static scoreGaps(largestGap: number): number {
    if (largestGap === 0) return 100; // No gaps
    if (largestGap <= 6) return 70;   // ≤6 months
    if (largestGap <= 12) return 40;  // 7-12 months
    return 20; // >12 months
  }
}
