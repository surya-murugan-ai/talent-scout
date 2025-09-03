import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { openai } from './openai.js';
import fs from 'fs';
import path from 'path';
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
export class ResumeParser {
    /**
     * Parse resume from buffer based on file type
     */
    static async parseResume(buffer, filename) {
        const startTime = Date.now();
        let rawText = '';
        let hyperlinks = [];
        try {
            // Determine file type and extract text with hyperlinks
            if (filename.toLowerCase().endsWith('.pdf')) {
                const pdfResult = await this.extractHyperlinksFromPDF(buffer);
                rawText = pdfResult.text;
                hyperlinks = pdfResult.hyperlinks;
            }
            else if (filename.toLowerCase().endsWith('.docx')) {
                const docxResult = await this.extractHyperlinksFromDOCX(buffer);
                rawText = docxResult.text;
                hyperlinks = docxResult.hyperlinks;
            }
            else if (filename.toLowerCase().endsWith('.doc')) {
                throw new Error('DOC files not supported. Please convert to DOCX format.');
            }
            else {
                throw new Error(`Unsupported file type: ${filename}. Only PDF and DOCX files are supported for resume parsing.`);
            }
            // Extract structured data from text and hyperlinks
            const extractedData = await this.extractDataFromText(rawText, filename, hyperlinks);
            const processingTime = Date.now() - startTime;
            // Calculate confidence based on extracted fields
            const confidence = this.calculateLLMConfidence(extractedData);
            const result = {
                rawText,
                extractedData,
                confidence,
                processingTime
            };
            // Save extracted data to output folder
            await this.saveExtractedData(result, filename);
            console.log('=== FINAL RESUME PARSING RESULT ===');
            console.log('File:', filename);
            console.log('Processing Time:', processingTime + 'ms');
            console.log('Confidence Score:', confidence + '%');
            console.log('Final Result:', JSON.stringify(result, null, 2));
            console.log('=== END FINAL RESULT ===');
            return result;
        }
        catch (error) {
            throw new Error(`Resume parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Save extracted resume data to output folder
     */
    static async saveExtractedData(result, filename) {
        try {
            // Create output directory if it doesn't exist
            const outputDir = path.join(process.cwd(), 'output_resume_extract');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            // Create timestamp for unique filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const baseName = path.parse(filename).name;
            const outputFilename = `${baseName}_${timestamp}.json`;
            const outputPath = path.join(outputDir, outputFilename);
            // Save the complete extracted data
            const outputData = {
                filename,
                timestamp: new Date().toISOString(),
                processingTime: result.processingTime,
                confidence: result.confidence,
                rawText: result.rawText,
                extractedData: result.extractedData
            };
            fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
            console.log(`✅ Extracted resume data saved to: ${outputPath}`);
            // Also save a summary file with just the key extracted information
            const summaryFilename = `${baseName}_${timestamp}_summary.json`;
            const summaryPath = path.join(outputDir, summaryFilename);
            const summaryData = {
                filename,
                timestamp: new Date().toISOString(),
                processingTime: result.processingTime,
                confidence: result.confidence,
                extractedData: {
                    name: result.extractedData.name,
                    email: result.extractedData.email,
                    phone: result.extractedData.phone,
                    title: result.extractedData.title,
                    location: result.extractedData.location,
                    summary: result.extractedData.summary,
                    experience: result.extractedData.experience,
                    education: result.extractedData.education,
                    skills: result.extractedData.skills,
                    projects: result.extractedData.projects,
                    certifications: result.extractedData.certifications
                }
            };
            fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
            console.log(`📋 Resume summary saved to: ${summaryPath}`);
        }
        catch (error) {
            console.error('Failed to save extracted data:', error);
            // Don't throw error as this is just for debugging
        }
    }
    /**
     * Save failed LLM response for debugging
     */
    static async saveFailedLLMResponse(content, filename, error) {
        try {
            // Create output directory if it doesn't exist
            const outputDir = path.join(process.cwd(), 'output_resume_extract');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            // Create timestamp for unique filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const baseName = path.parse(filename).name;
            const failedFilename = `${baseName}_${timestamp}_failed_llm.json`;
            const failedPath = path.join(outputDir, failedFilename);
            // Save the failed response data
            const failedData = {
                filename,
                timestamp: new Date().toISOString(),
                error: error.message,
                rawLLMResponse: content,
                note: 'This LLM response failed to parse as JSON. Check for markdown formatting or invalid JSON structure.'
            };
            fs.writeFileSync(failedPath, JSON.stringify(failedData, null, 2));
            console.log(`❌ Failed LLM response saved to: ${failedPath}`);
        }
        catch (saveError) {
            console.error('Failed to save failed LLM response:', saveError);
            // Don't throw error as this is just for debugging
        }
    }
    /**
     * Extract text from PDF using pdf-parse
     */
    static async extractFromPDF(buffer) {
        try {
            const data = await pdfParse(buffer);
            console.log('=== PDF EXTRACTION DEBUG ===');
            console.log('PDF Info:', {
                pages: data.numpages,
                info: data.info,
                metadata: data.metadata
            });
            console.log('Extracted Text Length:', data.text.length);
            console.log('First 500 characters of extracted text:');
            console.log(data.text.substring(0, 500));
            // Check if there are any URLs in the extracted text
            const urlMatches = data.text.match(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
            if (urlMatches) {
                console.log('Found URLs in PDF text:', urlMatches);
            }
            console.log('=== END PDF EXTRACTION DEBUG ===');
            return data.text;
        }
        catch (error) {
            throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Extract hyperlinks from PDF using pdfjs-dist annotations (NO URL GENERATION)
     */
    static async extractHyperlinksFromPDF(buffer) {
        try {
            console.log('=== PDF ANNOTATION EXTRACTION WITH PDFJS-DIST ===');
            // Convert Buffer to Uint8Array for pdfjs-dist
            const uint8Array = new Uint8Array(buffer);
            // Load PDF document
            const pdf = await getDocument(uint8Array).promise;
            console.log(`Processing ${pdf.numPages} pages...`);
            const hyperlinks = [];
            // Iterate through each page
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                try {
                    const page = await pdf.getPage(pageNum);
                    console.log(`\n--- Page ${pageNum} ---`);
                    // Get annotations from the page
                    const annotations = await page.getAnnotations();
                    console.log(`Found ${annotations.length} annotations on page ${pageNum}`);
                    // Process each annotation
                    for (const annotation of annotations) {
                        try {
                            console.log(`Annotation type: ${annotation.subtype}`);
                            // Check if it's a link annotation with URL
                            if (annotation.subtype === "Link" && annotation.url) {
                                console.log(`Found URL: ${annotation.url}`);
                                // Determine link text based on URL type
                                let linkText = 'Link';
                                if (annotation.url.includes('linkedin.com')) {
                                    linkText = 'LinkedIn';
                                }
                                else if (annotation.url.includes('github.com')) {
                                    linkText = 'GitHub';
                                }
                                else if (annotation.url.includes('portfolio') || annotation.url.includes('website')) {
                                    linkText = 'Portfolio';
                                }
                                hyperlinks.push({
                                    text: linkText,
                                    url: annotation.url
                                });
                            }
                            // Check if it has an action with URI
                            else if (annotation.subtype === "Link" && annotation.action && annotation.action.type === "URI") {
                                const url = annotation.action.uri;
                                console.log(`Found URI action: ${url}`);
                                let linkText = 'Link';
                                if (url.includes('linkedin.com')) {
                                    linkText = 'LinkedIn';
                                }
                                else if (url.includes('github.com')) {
                                    linkText = 'GitHub';
                                }
                                else if (url.includes('portfolio') || url.includes('website')) {
                                    linkText = 'Portfolio';
                                }
                                hyperlinks.push({
                                    text: linkText,
                                    url: url
                                });
                            }
                            // Check if it has a destination (internal link) - skip these
                            else if (annotation.subtype === "Link" && annotation.dest) {
                                console.log(`Found internal link (skipping): ${annotation.dest}`);
                            }
                            else if (annotation.subtype === "Link") {
                                console.log(`Link annotation found but no URL/destination`);
                            }
                        }
                        catch (annotationError) {
                            console.warn(`Error processing annotation on page ${pageNum}:`, annotationError instanceof Error ? annotationError.message : 'Unknown error');
                        }
                    }
                }
                catch (pageError) {
                    console.warn(`Error processing page ${pageNum}:`, pageError instanceof Error ? pageError.message : 'Unknown error');
                }
            }
            // Also extract text using pdf-parse for LLM processing
            const data = await pdfParse(buffer);
            const text = data.text;
            console.log(`\n=== EXTRACTION COMPLETE ===`);
            console.log(`Total hyperlinks found: ${hyperlinks.length}`);
            console.log('Hyperlinks:', hyperlinks);
            console.log('=== END PDF ANNOTATION EXTRACTION ===');
            return {
                text: text,
                hyperlinks: hyperlinks
            };
        }
        catch (error) {
            console.warn('PDF annotation extraction failed, falling back to basic text extraction:', error);
            // Fallback to basic text extraction
            const data = await pdfParse(buffer);
            return {
                text: data.text,
                hyperlinks: []
            };
        }
    }
    /**
     * Extract text from DOCX
     */
    static async extractFromDOCX(buffer) {
        try {
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        }
        catch (error) {
            throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Extract hyperlinks from DOCX using mammoth
     */
    static async extractHyperlinksFromDOCX(buffer) {
        try {
            // Extract text with hyperlinks
            const result = await mammoth.extractRawText({
                buffer
            });
            const hyperlinks = [];
            // Try to extract hyperlinks using mammoth's HTML conversion
            const htmlResult = await mammoth.convertToHtml({ buffer });
            // Parse HTML to find hyperlinks
            if (htmlResult.value) {
                const linkMatches = htmlResult.value.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g);
                if (linkMatches) {
                    linkMatches.forEach(match => {
                        const hrefMatch = match.match(/href="([^"]+)"/);
                        const textMatch = match.match(/>([^<]+)</);
                        if (hrefMatch && textMatch) {
                            hyperlinks.push({
                                text: textMatch[1].trim(),
                                url: hrefMatch[1]
                            });
                        }
                    });
                }
            }
            console.log('=== DOCX HYPERLINKS DEBUG ===');
            console.log('Found hyperlinks:', hyperlinks);
            console.log('=== END DOCX HYPERLINKS DEBUG ===');
            return {
                text: result.value,
                hyperlinks
            };
        }
        catch (error) {
            console.warn('DOCX hyperlink extraction failed, falling back to text only:', error);
            // Fallback to regular text extraction
            const text = await this.extractFromDOCX(buffer);
            return { text, hyperlinks: [] };
        }
    }
    /**
     * Extract structured data from raw text using LLM for comprehensive extraction
     */
    static async extractDataFromText(text, filename, hyperlinks = []) {
        const cleanText = text.replace(/\s+/g, ' ').trim();
        console.log('=== COMPREHENSIVE RESUME DATA EXTRACTION ===');
        console.log('Processing file:', filename);
        console.log('Clean text length:', cleanText.length);
        console.log('Found hyperlinks:', hyperlinks);
        try {
            // Use LLM for comprehensive extraction with hyperlinks
            const extractedData = await this.extractWithLLM(cleanText, filename, hyperlinks);
            console.log('LLM Extracted Data:');
            console.log(JSON.stringify(extractedData, null, 2));
            console.log('=== END COMPREHENSIVE RESUME DATA EXTRACTION ===');
            return extractedData;
        }
        catch (error) {
            console.error('LLM extraction failed, falling back to regex:', error);
            // Fallback to regex-based extraction with hyperlinks
            return this.extractWithRegex(cleanText, filename, hyperlinks);
        }
    }
    /**
   * Extract comprehensive data using OpenAI LLM
   */
    static async extractWithLLM(text, filename, hyperlinks = []) {
        // Create hyperlinks context for the LLM
        const hyperlinksContext = hyperlinks.length > 0 ? `
HYPERLINKS FOUND IN DOCUMENT:
${hyperlinks.map(link => `- "${link.text}" → ${link.url}`).join('\n')}

IMPORTANT: Use these hyperlinks to fill in the appropriate URL fields:
- If there's a hyperlink with text "LinkedIn" or URL containing "linkedin.com", use that URL for linkedinUrl
- If there's a hyperlink with text "GitHub" or URL containing "github.com", use that URL for githubUrl
- If there are other hyperlinks (not LinkedIn/GitHub), consider them for portfolioUrl
- These are ACTUAL URLs found in the document - do not generate or construct URLs

` : '';
        const prompt = `
Extract comprehensive information from this resume text and return it as a JSON object with the following structure:

{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number",
  "linkedinUrl": "LinkedIn profile URL",
  "githubUrl": "GitHub profile URL", 
  "portfolioUrl": "Portfolio/website URL",
  "location": "City, State/Country",
  "title": "Current job title",
  "summary": "Professional summary/objective",
  "experience": [
    {
      "jobTitle": "Job Title",
      "company": "Company Name",
      "duration": "Start Date - End Date",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or Present",
      "techUsed": ["Technology1", "Technology2"],
      "description": "Job description",
      "achievements": ["Achievement 1", "Achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Type",
      "field": "Field of Study",
      "university": "University Name",
      "year": "Graduation Year",
      "percentage": "Percentage/GPA",
      "gpa": "GPA if available",
      "location": "University Location"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Project description",
      "techUsed": ["Technology1", "Technology2"],
      "duration": "Project duration",
      "url": "Project URL if available",
      "achievements": ["Key achievement"]
    }
  ],
  "achievements": [
    {
      "title": "Achievement Title",
      "description": "Achievement description",
      "year": "Year",
      "organization": "Organization"
    }
  ],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "Date obtained",
      "expiryDate": "Expiry date if applicable",
      "credentialId": "Credential ID if available",
      "url": "Certification URL if available"
    }
  ],
  "skills": ["Skill1", "Skill2", "Skill3"],
  "interests": ["Interest1", "Interest2"],
  "languages": ["Language1", "Language2"]
}

${hyperlinksContext}Resume Text:
${text}

Extract all available information. If a field is not found, use null or empty array as appropriate. Be thorough and accurate. Return ONLY valid JSON without any markdown formatting or code blocks.

IMPORTANT: Look carefully for URLs in the text, including:
- LinkedIn URLs (linkedin.com/in/username or just "LinkedIn: username")
- GitHub URLs (github.com/username or just "GitHub: username") 
- Portfolio/website URLs (any domain like example.com, portfolio.com, etc.)
- These URLs might be hyperlinks, plain text, or just usernames that need to be converted to full URLs
- PAY SPECIAL ATTENTION to the hyperlinks provided above - they contain the actual URLs even if the text only shows "LinkedIn" or "GitHub"

IMPORTANT: Only extract URLs that actually exist in the resume text or hyperlinks. Do NOT generate or construct URLs based on names, email addresses, or other information. If no URL is found, use null. Only use the hyperlinks provided above if they contain actual URLs.
`;
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert resume parser. Extract comprehensive information from resume text and return it as valid JSON ONLY. Do not include any markdown formatting, code blocks, or additional text. Return pure JSON that can be parsed directly.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.1,
            max_tokens: 4000
        });
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from OpenAI');
        }
        try {
            // Clean the content to remove markdown code blocks
            let cleanContent = content.trim();
            // Remove ```json and ``` markers if present
            if (cleanContent.startsWith('```json')) {
                cleanContent = cleanContent.substring(7);
            }
            if (cleanContent.startsWith('```')) {
                cleanContent = cleanContent.substring(3);
            }
            if (cleanContent.endsWith('```')) {
                cleanContent = cleanContent.substring(0, cleanContent.length - 3);
            }
            cleanContent = cleanContent.trim();
            const extractedData = JSON.parse(cleanContent);
            // Add metadata
            extractedData.originalData = {
                filename,
                rawText: text.substring(0, 2000) // Store first 2000 chars
            };
            extractedData.source = 'resume';
            extractedData.confidence = this.calculateLLMConfidence(extractedData);
            extractedData.processingTime = 0; // Will be set by caller
            return extractedData;
        }
        catch (parseError) {
            console.error('Failed to parse LLM response:', parseError);
            console.error('LLM Response:', content);
            // Save the failed LLM response for debugging
            await ResumeParser.saveFailedLLMResponse(content, filename, parseError);
            throw new Error('Failed to parse LLM extraction result');
        }
    }
    /**
     * Fallback regex-based extraction
     */
    static extractWithRegex(text, filename, hyperlinks = []) {
        // Extract URLs from hyperlinks first
        const linkedinUrl = this.extractLinkedInFromHyperlinks(hyperlinks) || this.extractLinkedIn(text);
        const githubUrl = this.extractGitHubFromHyperlinks(hyperlinks) || this.extractGitHub(text);
        const portfolioUrl = this.extractPortfolioFromHyperlinks(hyperlinks) || this.extractPortfolioUrl(text);
        const extractedData = {
            name: this.extractName(text),
            email: this.extractEmail(text),
            phone: this.extractPhone(text),
            linkedinUrl,
            githubUrl,
            portfolioUrl,
            location: this.extractLocation(text),
            title: this.extractTitle(text),
            summary: this.extractSummary(text),
            experience: this.extractExperienceStructured(text),
            education: this.extractEducationStructured(text),
            projects: this.extractProjectsStructured(text),
            achievements: this.extractAchievementsStructured(text),
            certifications: this.extractCertificationsStructured(text),
            skills: this.extractSkills(text),
            interests: this.extractInterests(text),
            languages: this.extractLanguages(text),
            originalData: {
                filename,
                rawText: text.substring(0, 2000)
            },
            source: 'resume',
            confidence: this.calculateRegexConfidence(text),
            processingTime: 0
        };
        return extractedData;
    }
    /**
     * Extract name using various patterns
     */
    static extractName(text) {
        // Try multiple name extraction patterns
        const patterns = [
            // Name at the beginning of resume
            /^([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/m,
            // Name after "Name:" label
            /(?:Name|Full Name):\s*([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i,
            // First line with proper name format
            /^([A-Z][a-zA-Z\s]{2,40})/m
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                // Validate it looks like a real name (2-4 words, proper case)
                if (/^[A-Z][a-z]+(\s[A-Z][a-z]+){1,3}$/.test(name)) {
                    return name;
                }
            }
        }
        return 'Unknown';
    }
    /**
     * Extract email address
     */
    static extractEmail(text) {
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
        const match = text.match(emailPattern);
        return match ? match[0] : undefined;
    }
    /**
     * Extract phone number
     */
    static extractPhone(text) {
        const phonePatterns = [
            /(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/,
            /(?:\+91[-.\s]?)?[0-9]{10}/,
            /(?:\+[0-9]{1,3}[-.\s]?)?[0-9]{8,15}/
        ];
        for (const pattern of phonePatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[0].trim();
            }
        }
        return undefined;
    }
    /**
     * Extract LinkedIn URL
     */
    static extractLinkedIn(text) {
        const linkedinPatterns = [
            // Standard LinkedIn profile URLs
            /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+/,
            // LinkedIn URLs with additional path segments
            /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?/,
            // LinkedIn URLs that might be in hyperlinks or text
            /linkedin\.com\/in\/[a-zA-Z0-9-]+/,
            // LinkedIn URLs with different formats
            /(?:https?:\/\/)?linkedin\.com\/in\/[a-zA-Z0-9-]+/,
            // LinkedIn URLs with www
            /(?:https?:\/\/)?www\.linkedin\.com\/in\/[a-zA-Z0-9-]+/,
            // Just the username part (linkedin.com/in/username)
            /(?:linkedin|LinkedIn)[:\s]*[a-zA-Z0-9-]+/i,
            // LinkedIn URLs in parentheses or brackets
            /[\[\(](?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+[\]\)]/,
            // LinkedIn URLs with spaces around them
            /\s(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\s/
        ];
        for (const pattern of linkedinPatterns) {
            const match = text.match(pattern);
            if (match) {
                let url = match[0].trim();
                // If it's just a username, construct the full URL
                if (!url.includes('linkedin.com')) {
                    url = `https://linkedin.com/in/${url}`;
                }
                else if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                // Clean up the URL (remove trailing slashes, etc.)
                url = url.replace(/\/+$/, '');
                return url;
            }
        }
        // Only extract actual URLs, don't generate fake ones
        // If LinkedIn text exists but no URL found, return undefined
        if (text.toLowerCase().includes('linkedin') && !text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+/)) {
            console.log('LinkedIn text found in resume but no actual URL detected');
        }
        return undefined;
    }
    /**
     * Extract skills using keyword matching
     */
    static extractSkills(text) {
        const skillKeywords = [
            // Programming Languages
            'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin',
            // Frontend
            'React', 'Angular', 'Vue', 'HTML', 'CSS', 'Sass', 'Bootstrap', 'Tailwind', 'Next.js', 'Nuxt.js',
            // Backend
            'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Laravel', 'Rails', 'ASP.NET',
            // Databases
            'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle', 'SQL Server',
            // Cloud & DevOps
            'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'GitLab', 'GitHub Actions',
            // Tools & Others
            'Git', 'Linux', 'Windows', 'macOS', 'Figma', 'Photoshop', 'Excel', 'PowerBI', 'Tableau'
        ];
        const foundSkills = [];
        const lowerText = text.toLowerCase();
        skillKeywords.forEach(skill => {
            // Escape special regex characters
            const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedSkill.toLowerCase()}\\b`, 'i');
            if (regex.test(lowerText)) {
                foundSkills.push(skill);
            }
        });
        // Also look for skills sections
        const skillsSectionMatch = text.match(/(?:Skills?|Technologies?|Technical Skills?):\s*([^\n\r]{1,200})/i);
        if (skillsSectionMatch) {
            const skillsText = skillsSectionMatch[1];
            const additionalSkills = skillsText
                .split(/[,;|]/)
                .map(s => s.trim())
                .filter(s => s.length > 1 && s.length < 25);
            foundSkills.push(...additionalSkills);
        }
        return Array.from(new Set(foundSkills)); // Remove duplicates
    }
    /**
     * Extract years of experience
     */
    static extractExperience(text) {
        const experiencePatterns = [
            /(\d+)\+?\s*years?\s*(?:of\s*)?experience/i,
            /experience[:\s]*(\d+)\+?\s*years?/i,
            /(\d+)\+?\s*yrs?\s*exp/i
        ];
        for (const pattern of experiencePatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return `${match[1]} years`;
            }
        }
        return undefined;
    }
    /**
     * Extract current job title
     */
    static extractTitle(text) {
        // Look for common title patterns
        const titlePatterns = [
            /(?:Software Engineer|Developer|Programmer|Analyst|Manager|Director|Lead|Senior|Junior|Full Stack|Frontend|Backend|DevOps|Data Scientist|Product Manager)/i
        ];
        const lines = text.split('\n').slice(0, 10); // Look in first 10 lines
        for (const line of lines) {
            for (const pattern of titlePatterns) {
                if (pattern.test(line)) {
                    // Extract the title from the line
                    const titleMatch = line.match(/([A-Za-z\s]{10,50})/);
                    if (titleMatch) {
                        return titleMatch[1].trim();
                    }
                }
            }
        }
        return undefined;
    }
    /**
     * Extract current company
     */
    static extractCurrentCompany(text) {
        // Look for current employment indicators
        const companyPatterns = [
            /(?:currently at|working at|employed by)\s+([A-Za-z\s&.-]{2,50})/i,
            /(?:current employer|present employer):\s*([A-Za-z\s&.-]{2,50})/i
        ];
        for (const pattern of companyPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return undefined;
    }
    /**
     * Extract location
     */
    static extractLocation(text) {
        // Look for location patterns
        const locationPatterns = [
            /(?:Location|Address|Based in):\s*([A-Za-z\s,.-]{5,50})/i,
            /([A-Za-z\s]+,\s*[A-Za-z\s]{2,20})/ // City, State format
        ];
        for (const pattern of locationPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const location = match[1].trim();
                // Validate it looks like a real location
                if (location.length > 3 && location.length < 50) {
                    return location;
                }
            }
        }
        return undefined;
    }
    /**
     * Calculate confidence score for LLM extraction
     */
    static calculateLLMConfidence(data) {
        let score = 0;
        let maxScore = 0;
        // Basic info (essential)
        maxScore += 40;
        if (data.name && data.name !== 'Unknown')
            score += 15;
        if (data.email)
            score += 15;
        if (data.phone)
            score += 10;
        // Professional info (important)
        maxScore += 30;
        if (data.title)
            score += 10;
        if (data.summary)
            score += 10;
        if (data.experience && data.experience.length > 0)
            score += 10;
        // Skills and education (useful)
        maxScore += 20;
        if (data.skills && data.skills.length > 0)
            score += 10;
        if (data.education && data.education.length > 0)
            score += 10;
        // Additional sections (bonus)
        maxScore += 10;
        if (data.projects && data.projects.length > 0)
            score += 3;
        if (data.certifications && data.certifications.length > 0)
            score += 3;
        if (data.achievements && data.achievements.length > 0)
            score += 2;
        if (data.linkedinUrl || data.githubUrl)
            score += 2;
        return Math.round((score / maxScore) * 100);
    }
    /**
     * Calculate confidence score for regex extraction
     */
    static calculateRegexConfidence(text) {
        let score = 0;
        let maxScore = 100;
        // Check for key resume sections
        const sections = ['experience', 'education', 'skills', 'projects', 'certifications'];
        sections.forEach(section => {
            if (text.toLowerCase().includes(section)) {
                score += 15;
            }
        });
        // Check for contact info
        if (text.includes('@'))
            score += 10; // Email
        if (/\d{10,}/.test(text))
            score += 10; // Phone
        if (text.toLowerCase().includes('linkedin'))
            score += 5;
        return Math.min(score, maxScore);
    }
    // New extraction methods for comprehensive data
    static extractGitHub(text) {
        const githubPatterns = [
            // Standard GitHub profile URLs
            /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+/,
            // GitHub URLs with additional path segments
            /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+\/?/,
            // GitHub URLs that might be in hyperlinks or text
            /github\.com\/[a-zA-Z0-9-]+/,
            // GitHub URLs with different formats
            /(?:https?:\/\/)?github\.com\/[a-zA-Z0-9-]+/,
            // GitHub URLs with www
            /(?:https?:\/\/)?www\.github\.com\/[a-zA-Z0-9-]+/,
            // Just the username part (github.com/username)
            /(?:github|GitHub)[:\s]*[a-zA-Z0-9-]+/i,
            // GitHub URLs in parentheses or brackets
            /[\[\(](?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+[\]\)]/,
            // GitHub URLs with spaces around them
            /\s(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+\s/
        ];
        for (const pattern of githubPatterns) {
            const match = text.match(pattern);
            if (match) {
                let url = match[0].trim();
                // If it's just a username, construct the full URL
                if (!url.includes('github.com')) {
                    url = `https://github.com/${url}`;
                }
                else if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                // Clean up the URL (remove trailing slashes, etc.)
                url = url.replace(/\/+$/, '');
                return url;
            }
        }
        // Only extract actual URLs, don't generate fake ones
        // If GitHub text exists but no URL found, return undefined
        if (text.toLowerCase().includes('github') && !text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+/)) {
            console.log('GitHub text found in resume but no actual URL detected');
        }
        return undefined;
    }
    static extractSummary(text) {
        const summaryPatterns = [
            /(?:summary|objective|profile|about)[:\s]*([^\n\r]{50,500})/i,
            /(?:professional summary|career objective)[:\s]*([^\n\r]{50,500})/i
        ];
        for (const pattern of summaryPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return undefined;
    }
    static extractExperienceStructured(text) {
        // This is a simplified version - LLM will handle complex extraction
        const experiences = [];
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/(?:software engineer|developer|analyst|manager|director)/i)) {
                experiences.push({
                    jobTitle: line.trim(),
                    company: lines[i + 1]?.trim() || 'Unknown',
                    duration: 'Unknown',
                    techUsed: [],
                    description: line.trim()
                });
            }
        }
        return experiences;
    }
    static extractEducationStructured(text) {
        const education = [];
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/(?:bachelor|master|phd|degree|university|college)/i)) {
                education.push({
                    degree: line.trim(),
                    field: 'Unknown',
                    university: lines[i + 1]?.trim() || 'Unknown',
                    year: 'Unknown'
                });
            }
        }
        return education;
    }
    static extractProjectsStructured(text) {
        const projects = [];
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/(?:project|application|system|website|app)/i)) {
                projects.push({
                    name: line.trim(),
                    description: line.trim(),
                    techUsed: []
                });
            }
        }
        return projects;
    }
    static extractAchievementsStructured(text) {
        const achievements = [];
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/(?:award|achievement|recognition|honor)/i)) {
                achievements.push({
                    title: line.trim(),
                    description: line.trim()
                });
            }
        }
        return achievements;
    }
    static extractCertificationsStructured(text) {
        const certifications = [];
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/(?:certification|certificate|license|credential)/i)) {
                certifications.push({
                    name: line.trim(),
                    issuer: 'Unknown',
                    date: 'Unknown'
                });
            }
        }
        return certifications;
    }
    static extractInterests(text) {
        const interests = [];
        const interestPattern = /(?:interests?|hobbies?)[:\s]*([^\n\r]{10,200})/i;
        const match = text.match(interestPattern);
        if (match && match[1]) {
            const interestText = match[1];
            const interestList = interestText
                .split(/[,;|]/)
                .map(s => s.trim())
                .filter(s => s.length > 2 && s.length < 30);
            interests.push(...interestList);
        }
        return interests;
    }
    static extractLanguages(text) {
        const languages = [];
        const languagePattern = /(?:languages?|spoken languages?)[:\s]*([^\n\r]{10,100})/i;
        const match = text.match(languagePattern);
        if (match && match[1]) {
            const languageText = match[1];
            const languageList = languageText
                .split(/[,;|]/)
                .map(s => s.trim())
                .filter(s => s.length > 2 && s.length < 20);
            languages.push(...languageList);
        }
        return languages;
    }
    /**
     * Extract portfolio/website URLs
     */
    static extractPortfolioUrl(text) {
        const portfolioPatterns = [
            // Common portfolio domains
            /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|net|org|io|dev|me|co|uk|ca|au)\/[a-zA-Z0-9-]*/,
            // Personal websites
            /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|net|org|io|dev|me|co|uk|ca|au)/,
            // Portfolio keywords
            /(?:portfolio|website|personal site|blog)[:\s]*(?:https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i
        ];
        for (const pattern of portfolioPatterns) {
            const match = text.match(pattern);
            if (match) {
                let url = match[0].trim();
                // Skip if it's LinkedIn or GitHub (already handled separately)
                if (url.includes('linkedin.com') || url.includes('github.com')) {
                    continue;
                }
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                return url;
            }
        }
        return undefined;
    }
    /**
     * Extract LinkedIn URL from hyperlinks
     */
    static extractLinkedInFromHyperlinks(hyperlinks) {
        for (const link of hyperlinks) {
            // Check if the URL is a LinkedIn URL
            if (link.url.includes('linkedin.com/in/')) {
                return link.url.startsWith('http') ? link.url : `https://${link.url}`;
            }
            // Check if the text suggests it's LinkedIn
            if (link.text.toLowerCase().includes('linkedin') && link.url.includes('linkedin.com')) {
                return link.url.startsWith('http') ? link.url : `https://${link.url}`;
            }
        }
        return undefined;
    }
    /**
     * Extract GitHub URL from hyperlinks
     */
    static extractGitHubFromHyperlinks(hyperlinks) {
        for (const link of hyperlinks) {
            // Check if the URL is a GitHub URL
            if (link.url.includes('github.com/')) {
                return link.url.startsWith('http') ? link.url : `https://${link.url}`;
            }
            // Check if the text suggests it's GitHub
            if (link.text.toLowerCase().includes('github') && link.url.includes('github.com')) {
                return link.url.startsWith('http') ? link.url : `https://${link.url}`;
            }
        }
        return undefined;
    }
    /**
     * Extract portfolio URL from hyperlinks
     */
    static extractPortfolioFromHyperlinks(hyperlinks) {
        for (const link of hyperlinks) {
            // Skip LinkedIn and GitHub URLs
            if (link.url.includes('linkedin.com') || link.url.includes('github.com')) {
                continue;
            }
            // Check if it's a valid domain
            if (link.url.includes('.') && (link.url.includes('.com') || link.url.includes('.net') ||
                link.url.includes('.org') || link.url.includes('.io') || link.url.includes('.dev'))) {
                return link.url.startsWith('http') ? link.url : `https://${link.url}`;
            }
            // Check if the text suggests it's a portfolio/website
            const portfolioKeywords = ['portfolio', 'website', 'personal', 'blog', 'site'];
            if (portfolioKeywords.some(keyword => link.text.toLowerCase().includes(keyword))) {
                return link.url.startsWith('http') ? link.url : `https://${link.url}`;
            }
        }
        return undefined;
    }
    /**
     * Parse multiple resumes from a ZIP file or individual files
     */
    static async parseMultipleResumes(files) {
        const results = [];
        const errors = [];
        for (const file of files) {
            try {
                const result = await this.parseResume(file.buffer, file.filename);
                results.push(result);
            }
            catch (error) {
                errors.push(`${file.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        if (errors.length > 0) {
            console.warn('Resume parsing errors:', errors);
        }
        return results;
    }
}
