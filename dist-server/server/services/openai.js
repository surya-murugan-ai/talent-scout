import OpenAI from "openai";
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || ""
});
export async function analyzeCandidate(candidateData, jobDescription = "", weights) {
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
- Company Consistency: ${weights.companyDifference}%

Please analyze this candidate and provide scores (0-10) for each criterion, an overall weighted score, priority level (High/Medium/Low), and actionable insights.

Consider the company consistency between resume and LinkedIn data as an important factor in assessing candidate reliability and current status.

Respond with JSON in this exact format:
{
  "skillMatch": number (0-10),
  "openToWork": number (0-10),
  "jobStability": number (0-10),
  "engagement": number (0-10),
  "companyConsistency": number (0-10),
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
            companyConsistency: Math.max(0, Math.min(10, analysis.companyConsistency || 0)),
            overallScore: Math.max(0, Math.min(10, analysis.overallScore || 0)),
            priority: ['High', 'Medium', 'Low'].includes(analysis.priority) ? analysis.priority : 'Low',
            insights: Array.isArray(analysis.insights) ? analysis.insights.slice(0, 5) : []
        };
    }
    catch (error) {
        console.error('OpenAI analysis error:', error);
        throw new Error(`Failed to analyze candidate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
// Real LinkedIn API integration using Apify
import { linkedInService } from './linkedin';
export async function enrichLinkedInProfile(linkedinUrl, name, company, title, location, candidates) {
    console.log(`Enriching LinkedIn profile for: ${name} ${title ? `(${title})` : ''} ${company ? `at ${company}` : ''} ${location ? `in ${location}` : ''}`);
    try {
        // Use the updated enrichProfile method that can search by name with enhanced scoring
        const profile = await linkedInService.enrichProfile(linkedinUrl, name, company, title, location, candidates);
        if (!profile) {
            throw new Error('Failed to fetch LinkedIn profile - no data returned');
        }
        // Enhanced "Open to Work" detection
        const openToWork = detectOpenToWorkStatus(profile, title);
        return {
            name: profile.name || name,
            title: profile.headline || profile.currentPosition || title || "Professional",
            company: profile.currentCompany || company || "Unknown Company",
            skills: profile.skills || [],
            openToWork: openToWork,
            lastActive: "Recently active",
            profileUrl: profile.profileUrl, // Return the LinkedIn URL!
            jobHistory: profile.experience?.map(exp => ({
                company: exp.company,
                role: exp.title,
                duration: exp.duration
            })) || [],
            recentActivity: profile.posts?.map(post => post.text).slice(0, 3) || []
        };
    }
    catch (error) {
        console.error('LinkedIn enrichment failed:', error);
        // Create a basic profile instead of throwing an error
        console.log(`Creating basic profile for ${name} due to enrichment failure`);
        return {
            name: name,
            title: title || "Professional",
            company: company || "Unknown Company",
            skills: [],
            openToWork: false,
            lastActive: "Recently active",
            profileUrl: linkedinUrl,
            jobHistory: [],
            recentActivity: []
        };
    }
}
/**
 * Enhanced function to detect if a candidate is open to work
 */
function detectOpenToWorkStatus(profile, candidateTitle) {
    const openSignals = [
        'open to work',
        'open for opportunity',
        'open for opportunities',
        'seeking',
        'looking for',
        'available',
        'opportunity',
        'opportunities',
        'job search',
        'actively looking',
        'actively seeking',
        'open to new opportunities',
        'open to new roles',
        'open to new positions',
        'available for opportunities',
        'seeking new opportunities',
        'looking for new opportunities',
        'open to work',
        'open for work',
        'available for work'
    ];
    // Check multiple fields for open to work signals
    const fieldsToCheck = [
        profile.headline || '',
        profile.title || '',
        profile.currentPosition || '',
        profile.summary || '',
        profile.about || '',
        candidateTitle || '', // Check the original candidate title from CSV
        ...(profile.posts || []).map((post) => post.text || ''),
        ...(profile.recentActivity || [])
    ];
    const fullText = fieldsToCheck.join(' ').toLowerCase();
    // Check if any open signal is present
    const hasOpenSignal = openSignals.some(signal => fullText.includes(signal));
    // Log the detection for debugging
    if (hasOpenSignal) {
        console.log(`Open to Work detected for ${profile.name || 'candidate'}: Found signals in text`);
    }
    return hasOpenSignal;
}
// Update the fallback function to also use the enhanced detection
async function generateLinkedInProfile(name, company, title) {
    try {
        const prompt = `
Generate a realistic LinkedIn profile enrichment for a candidate with the following information:
Name: ${name}
${company ? `Current Company: ${company}` : ''}
${title ? `Current Title: ${title}` : ''}

Create a realistic professional profile that includes:
- Current job title
- Skills relevant to their field
- Job history with realistic companies and durations
- Recent professional activity indicators
- Open to work status based on typical patterns

IMPORTANT: If the title contains phrases like "Open for Opportunity", "Seeking", "Looking for", "Available", etc., set openToWork to true.

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
        // Use enhanced detection for fallback profiles too
        const openToWork = detectOpenToWorkStatus(profile, title);
        return {
            name: profile.name || name,
            title: profile.title || title || "Professional",
            company: profile.company || company || "Unknown Company",
            skills: Array.isArray(profile.skills) ? profile.skills : [],
            openToWork: openToWork,
            lastActive: profile.lastActive || "1 week ago",
            jobHistory: Array.isArray(profile.jobHistory) ? profile.jobHistory : [],
            recentActivity: Array.isArray(profile.recentActivity) ? profile.recentActivity : []
        };
    }
    catch (error) {
        console.error('LinkedIn enrichment error:', error);
        // Return basic profile on error with enhanced detection
        const basicProfile = {
            name,
            title: title || "Professional",
            company: company || "Unknown Company",
            skills: [],
            openToWork: false,
            lastActive: "1 week ago",
            jobHistory: [],
            recentActivity: []
        };
        // Apply enhanced detection even to basic profiles
        basicProfile.openToWork = detectOpenToWorkStatus(basicProfile, title);
        return basicProfile;
    }
}
export async function batchAnalyzeCandidates(candidates, jobDescription = "", weights, onProgress) {
    const results = [];
    for (let i = 0; i < candidates.length; i++) {
        try {
            const analysis = await analyzeCandidate(candidates[i], jobDescription, weights);
            results.push(analysis);
            if (onProgress) {
                onProgress(i + 1, candidates.length);
            }
            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        catch (error) {
            console.error(`Error analyzing candidate ${i}:`, error);
            // Add default analysis on error
            results.push({
                skillMatch: 0,
                openToWork: 0,
                jobStability: 0,
                engagement: 0,
                companyConsistency: 0,
                overallScore: 0,
                priority: 'Low',
                insights: ['Analysis failed - manual review required']
            });
        }
    }
    return results;
}
export { openai };
