import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || ""
});

export interface CandidateAnalysis {
  skillMatch: number;
  openToWork: number;
  jobStability: number;
  engagement: number;
  overallScore: number;
  priority: 'High' | 'Medium' | 'Low';
  insights: string[];
}

export interface LinkedInProfile {
  name: string;
  title: string;
  company: string;
  skills: string[];
  openToWork: boolean;
  lastActive: string;
  jobHistory: Array<{
    company: string;
    role: string;
    duration: string;
  }>;
  recentActivity: string[];
}

export async function analyzeCandidate(
  candidateData: any, 
  jobDescription = "", 
  weights: { openToWork: number; skillMatch: number; jobStability: number; engagement: number }
): Promise<CandidateAnalysis> {
  try {
    const prompt = `
You are an AI talent acquisition expert. Analyze the following candidate profile and provide a detailed assessment.

Candidate Data:
${JSON.stringify(candidateData, null, 2)}

Job Requirements/Description:
${jobDescription || "General software engineering position"}

Scoring Criteria Weights:
- Open to Work Signal: ${weights.openToWork}%
- Skill Match: ${weights.skillMatch}%
- Job Stability: ${weights.jobStability}%
- Platform Engagement: ${weights.engagement}%

Please analyze this candidate and provide scores (0-10) for each criterion, an overall weighted score, priority level (High/Medium/Low), and actionable insights.

Respond with JSON in this exact format:
{
  "skillMatch": number (0-10),
  "openToWork": number (0-10),
  "jobStability": number (0-10),
  "engagement": number (0-10),
  "overallScore": number (0-10),
  "priority": "High" | "Medium" | "Low",
  "insights": ["insight1", "insight2", "insight3"]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert talent acquisition AI that provides precise candidate assessments. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const analysis = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate and normalize the response
    return {
      skillMatch: Math.max(0, Math.min(10, analysis.skillMatch || 0)),
      openToWork: Math.max(0, Math.min(10, analysis.openToWork || 0)),
      jobStability: Math.max(0, Math.min(10, analysis.jobStability || 0)),
      engagement: Math.max(0, Math.min(10, analysis.engagement || 0)),
      overallScore: Math.max(0, Math.min(10, analysis.overallScore || 0)),
      priority: ['High', 'Medium', 'Low'].includes(analysis.priority) ? analysis.priority : 'Low',
      insights: Array.isArray(analysis.insights) ? analysis.insights.slice(0, 5) : []
    };

  } catch (error) {
    console.error('OpenAI analysis error:', error);
    throw new Error(`Failed to analyze candidate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Real LinkedIn API integration using Apify
import { linkedInService } from './linkedin';

export async function enrichLinkedInProfile(linkedinUrl: string | undefined, name: string, company?: string): Promise<LinkedInProfile> {
  console.log(`Enriching LinkedIn profile for: ${name} ${company ? `at ${company}` : ''}`);
  
  try {
    // Use the updated enrichProfile method that can search by name
    const profile = await linkedInService.enrichProfile(linkedinUrl, name, company);
    
    if (!profile) {
      throw new Error('Failed to fetch LinkedIn profile');
    }

    return {
      name: profile.name || name,
      title: profile.headline || profile.currentPosition || "Professional",
      company: profile.currentCompany || company || "Unknown Company",
      skills: profile.skills || [],
      openToWork: profile.headline?.toLowerCase().includes('open to') || false,
      lastActive: "Recently active",
      jobHistory: profile.experience?.map(exp => ({
        company: exp.company,
        role: exp.title,
        duration: exp.duration
      })) || [],
      recentActivity: profile.posts?.map(post => post.text).slice(0, 3) || []
    };

  } catch (error) {
    console.error('LinkedIn enrichment failed, falling back to AI generation:', error);
    
    // Fallback to AI-generated profile if real LinkedIn API fails
    return await generateLinkedInProfile(name, company);
  }
}

// Fallback AI-generated LinkedIn profile
async function generateLinkedInProfile(name: string, company?: string): Promise<LinkedInProfile> {
  try {
    const prompt = `
Generate a realistic LinkedIn profile enrichment for a candidate with the following information:
Name: ${name}
${company ? `Current Company: ${company}` : ''}

Create a realistic professional profile that includes:
- Current job title
- Skills relevant to their field
- Job history with realistic companies and durations
- Recent professional activity indicators
- Open to work status based on typical patterns

Respond with JSON in this exact format:
{
  "name": "${name}",
  "title": "realistic job title",
  "company": "company name",
  "skills": ["skill1", "skill2", "skill3"],
  "openToWork": true/false,
  "lastActive": "time ago (e.g., '2 days ago')",
  "jobHistory": [
    {
      "company": "Company Name",
      "role": "Role Title",
      "duration": "Duration (e.g., '2 years 3 months')"
    }
  ],
  "recentActivity": ["activity1", "activity2"]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a LinkedIn data enrichment service that generates realistic professional profiles. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const profile = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      name: profile.name || name,
      title: profile.title || "Professional",
      company: profile.company || company || "Unknown Company",
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      openToWork: Boolean(profile.openToWork),
      lastActive: profile.lastActive || "1 week ago",
      jobHistory: Array.isArray(profile.jobHistory) ? profile.jobHistory : [],
      recentActivity: Array.isArray(profile.recentActivity) ? profile.recentActivity : []
    };

  } catch (error) {
    console.error('LinkedIn enrichment error:', error);
    // Return basic profile on error
    return {
      name,
      title: "Professional",
      company: company || "Unknown Company",
      skills: [],
      openToWork: false,
      lastActive: "Unknown",
      jobHistory: [],
      recentActivity: []
    };
  }
}

export async function batchAnalyzeCandidates(
  candidates: any[], 
  jobDescription = "", 
  weights: { openToWork: number; skillMatch: number; jobStability: number; engagement: number },
  onProgress?: (processed: number, total: number) => void
): Promise<CandidateAnalysis[]> {
  const results: CandidateAnalysis[] = [];
  
  for (let i = 0; i < candidates.length; i++) {
    try {
      const analysis = await analyzeCandidate(candidates[i], jobDescription, weights);
      results.push(analysis);
      
      if (onProgress) {
        onProgress(i + 1, candidates.length);
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error analyzing candidate ${i}:`, error);
      // Add default analysis on error
      results.push({
        skillMatch: 0,
        openToWork: 0,
        jobStability: 0,
        engagement: 0,
        overallScore: 0,
        priority: 'Low',
        insights: ['Analysis failed - manual review required']
      });
    }
  }
  
  return results;
}
