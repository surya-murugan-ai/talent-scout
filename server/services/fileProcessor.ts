import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import { ResumeParser, ResumeData, ComprehensiveResumeData } from './resumeParser.js';
import { ResumeDataService } from './resumeDataService.js';

export interface ProcessedCandidate {
  name: string;
  email?: string;
  title?: string;
  company?: string;
  skills?: string[];
  linkedinUrl?: string;
  location?: string;
  phone?: string;
  experience?: string;
  atsId?: string;
  selectionStatus?: string;
  selectionDate?: string;
  joiningOutcome?: string;
  atsNotes?: string;
  
  // Enhanced fields for better data extraction
  firstName?: string;
  lastName?: string;
  middleName?: string;
  currentTitle?: string;
  currentCompany?: string;
  yearsOfExperience?: number;
  education?: Array<{
    degree: string;
    institution: string;
    field: string;
    graduationYear?: number;
  }>;
  workHistory?: Array<{
    title: string;
    company: string;
    duration: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    date?: string;
    expiryDate?: string;
  }>;
  languages?: string[];
  salary?: string;
  availability?: string;
  remotePreference?: string;
  visaStatus?: string;
  linkedinHeadline?: string;
  linkedinSummary?: string;
  linkedinConnections?: number;
  linkedinLastActive?: string;
  
  // Contact information
  alternateEmail?: string;
  website?: string;
  github?: string;
  portfolio?: string;
  
  // Additional metadata
  sourceFile?: string;
  processingDate?: string;
  dataQuality?: number; // 0-100 score of data completeness
  
  [key: string]: any;
}

export class FileProcessor {
  static async processCSV(buffer: Buffer): Promise<ProcessedCandidate[]> {
    return new Promise((resolve, reject) => {
      const results: ProcessedCandidate[] = [];
      const stream = Readable.from(buffer.toString());
      
      stream
        .pipe(csv())
        .on('data', (data: any) => {
          const candidate = this.normalizeCandidate(data);
          if (candidate.name) {
            results.push(candidate);
          }
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error: any) => {
          reject(error);
        });
    });
  }

  static async processExcel(buffer: Buffer): Promise<ProcessedCandidate[]> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      return jsonData
        .map((row: any) => this.normalizeCandidate(row))
        .filter((candidate) => candidate.name);
    } catch (error) {
      throw new Error(`Excel processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static normalizeCandidate(rawData: any): ProcessedCandidate {
    // Enhanced field mappings for different data formats
    const fieldMappings = {
      name: ['name', 'full_name', 'candidate_name', 'fullname', 'Name', 'Full Name', 'Candidate Name'],
      firstName: ['first_name', 'firstName', 'firstname', 'First Name', 'First'],
      lastName: ['last_name', 'lastName', 'lastname', 'Last Name', 'Last'],
      middleName: ['middle_name', 'middleName', 'middle', 'Middle Name', 'Middle'],
      email: ['email', 'email_address', 'Email', 'Email Address', 'Primary Email'],
      alternateEmail: ['alternate_email', 'secondary_email', 'Alt Email', 'Secondary Email'],
      title: ['title', 'job_title', 'position', 'role', 'Title', 'Job Title', 'Position', 'Current Title'],
      currentTitle: ['current_title', 'currentTitle', 'Current Title', 'Present Title'],
      company: ['company', 'employer', 'current_company', 'Company', 'Employer', 'Current Company'],
      currentCompany: ['current_company', 'currentCompany', 'Current Company', 'Present Company'],
      skills: ['skills', 'skill_set', 'technologies', 'Skills', 'Technologies', 'Technical Skills', 'Competencies'],
      linkedinUrl: ['linkedin', 'linkedin_url', 'linkedinUrl', 'LinkedIn', 'LinkedIn URL', 'Profile URL'],
      location: ['location', 'city', 'Location', 'City', 'Current Location', 'Address'],
      phone: ['phone', 'phone_number', 'Phone', 'Phone Number', 'Mobile', 'Contact'],
      experience: ['experience', 'years_experience', 'Experience', 'Years Experience', 'Total Experience'],
      yearsOfExperience: ['years_of_experience', 'yearsExperience', 'Years of Experience', 'Experience Years'],
      atsId: ['atsId', 'ats_id', 'ATS ID', 'Candidate ID', 'ID', 'Employee ID'],
      selectionStatus: ['selectionStatus', 'selection_status', 'Status', 'Selection Status', 'Application Status'],
      selectionDate: ['selectionDate', 'selection_date', 'Date', 'Selection Date', 'Application Date'],
      joiningOutcome: ['joiningOutcome', 'joining_outcome', 'Outcome', 'Joining Outcome', 'Hiring Outcome'],
      atsNotes: ['atsNotes', 'ats_notes', 'Notes', 'ATS Notes', 'Comments'],
      linkedinHeadline: ['linkedin_headline', 'headline', 'Headline', 'Professional Headline'],
      linkedinSummary: ['linkedin_summary', 'summary', 'Summary', 'Professional Summary'],
      linkedinConnections: ['linkedin_connections', 'connections', 'Connections', 'Network Size'],
      linkedinLastActive: ['linkedin_last_active', 'last_active', 'Last Active', 'Profile Last Active'],
      salary: ['salary', 'expected_salary', 'Salary', 'Expected Salary', 'Compensation'],
      availability: ['availability', 'available_from', 'Availability', 'Available From', 'Start Date'],
      remotePreference: ['remote_preference', 'remote', 'Remote Preference', 'Work Preference'],
      visaStatus: ['visa_status', 'visa', 'Visa Status', 'Work Authorization'],
      website: ['website', 'portfolio_url', 'Website', 'Portfolio URL'],
      github: ['github', 'github_url', 'GitHub', 'GitHub URL'],
      portfolio: ['portfolio', 'portfolio_url', 'Portfolio', 'Portfolio URL'],
      languages: ['languages', 'language', 'Languages', 'Language Skills'],
      education: ['education', 'education_history', 'Education', 'Education History'],
      workHistory: ['work_history', 'experience_history', 'Work History', 'Experience History'],
      certifications: ['certifications', 'certificates', 'Certifications', 'Certificates']
    };

    const candidate: ProcessedCandidate = { name: '' };

    Object.entries(fieldMappings).forEach(([standardField, possibleFields]) => {
      const value = possibleFields.find(field => rawData[field] !== undefined && rawData[field] !== null);
      if (value) {
        if (standardField === 'skills' && typeof rawData[value] === 'string') {
          // Enhanced skills parsing
          candidate[standardField] = this.parseSkills(rawData[value]);
        } else if (standardField === 'languages' && typeof rawData[value] === 'string') {
          // Parse languages
          candidate[standardField] = this.parseLanguages(rawData[value]);
        } else if (standardField === 'education' && typeof rawData[value] === 'string') {
          // Parse education history
          candidate[standardField] = this.parseEducation(rawData[value]);
        } else if (standardField === 'workHistory' && typeof rawData[value] === 'string') {
          // Parse work history
          candidate[standardField] = this.parseWorkHistory(rawData[value]);
        } else if (standardField === 'certifications' && typeof rawData[value] === 'string') {
          // Parse certifications
          candidate[standardField] = this.parseCertifications(rawData[value]);
        } else if (standardField === 'yearsOfExperience' && typeof rawData[value] === 'string') {
          // Parse years of experience
          candidate[standardField] = this.parseYearsOfExperience(rawData[value]);
        } else {
          candidate[standardField] = rawData[value];
        }
      }
    });

    // Process name if we have firstName and lastName but no full name
    if (!candidate.name && (candidate.firstName || candidate.lastName)) {
      candidate.name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
    }

    // Calculate data quality score
    candidate.dataQuality = this.calculateDataQuality(candidate);
    candidate.processingDate = new Date().toISOString();

    // Store original data for reference
    candidate.originalData = rawData;

    return candidate;
  }

  private static parseSkills(skillsString: string): string[] {
    // Enhanced skills parsing with multiple separators and cleaning
    return skillsString
      .split(/[,;|&+\n\r\t]/) // Multiple separators
      .map(skill => skill.trim())
      .filter(skill => skill.length > 0 && skill.length < 100) // Reasonable length
      .map(skill => this.normalizeSkill(skill))
      .filter((skill, index, arr) => arr.indexOf(skill) === index); // Remove duplicates
  }

  private static normalizeSkill(skill: string): string {
    // Normalize skill names (remove extra spaces, standardize case)
    return skill
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letter of each word
  }

  private static parseLanguages(languagesString: string): string[] {
    return languagesString
      .split(/[,;|&+\n\r\t]/)
      .map(lang => lang.trim())
      .filter(lang => lang.length > 0)
      .map(lang => lang.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()));
  }

  private static parseEducation(educationString: string): Array<{
    degree: string;
    institution: string;
    field: string;
    graduationYear?: number;
  }> {
    // Basic education parsing - can be enhanced with more sophisticated parsing
    const educationEntries = educationString.split(/[,;|&+\n\r\t]/);
    return educationEntries
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0)
      .map(entry => {
        // Extract year if present
        const yearMatch = entry.match(/\b(19|20)\d{2}\b/);
        const graduationYear = yearMatch ? parseInt(yearMatch[0]) : undefined;
        
        return {
          degree: 'Bachelor\'s', // Default - can be enhanced with degree detection
          institution: entry.replace(/\b(19|20)\d{2}\b/g, '').trim(),
          field: 'Computer Science', // Default - can be enhanced
          graduationYear
        };
      });
  }

  private static parseWorkHistory(workHistoryString: string): Array<{
    title: string;
    company: string;
    duration: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }> {
    // Basic work history parsing - can be enhanced
    const workEntries = workHistoryString.split(/[,;|&+\n\r\t]/);
    return workEntries
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0)
      .map(entry => {
        // Simple parsing - can be enhanced with more sophisticated parsing
        const parts = entry.split(' at ');
        return {
          title: parts[0] || 'Unknown',
          company: parts[1] || 'Unknown',
          duration: 'Unknown',
          description: entry
        };
      });
  }

  private static parseCertifications(certificationsString: string): Array<{
    name: string;
    issuer: string;
    date?: string;
    expiryDate?: string;
  }> {
    const certEntries = certificationsString.split(/[,;|&+\n\r\t]/);
    return certEntries
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0)
      .map(entry => {
        // Extract date if present
        const dateMatch = entry.match(/\b(19|20)\d{2}\b/);
        const date = dateMatch ? dateMatch[0] : undefined;
        
        return {
          name: entry.replace(/\b(19|20)\d{2}\b/g, '').trim(),
          issuer: 'Unknown', // Can be enhanced with issuer detection
          date
        };
      });
  }

  private static parseYearsOfExperience(experienceString: string): number {
    // Extract years from various formats
    const yearMatch = experienceString.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y)/i);
    if (yearMatch) {
      return parseFloat(yearMatch[1]);
    }
    
    // Try to extract just numbers
    const numberMatch = experienceString.match(/(\d+(?:\.\d+)?)/);
    if (numberMatch) {
      return parseFloat(numberMatch[1]);
    }
    
    return 0;
  }

  private static calculateDataQuality(candidate: ProcessedCandidate): number {
    // Calculate data quality score based on completeness
    const fields = [
      'name', 'email', 'title', 'company', 'skills', 'linkedinUrl',
      'location', 'phone', 'experience', 'education', 'workHistory'
    ];
    
    let filledFields = 0;
    fields.forEach(field => {
      const value = candidate[field as keyof ProcessedCandidate];
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value) && value.length > 0) {
          filledFields++;
        } else if (!Array.isArray(value)) {
          filledFields++;
        }
      }
    });
    
    return Math.round((filledFields / fields.length) * 100);
  }

  static getSupportedFileTypes(): string[] {
    return ['.csv', '.xlsx', '.xls', '.pdf', '.docx'];
  }

  static validateFileType(filename: string): boolean {
    const supportedTypes = this.getSupportedFileTypes();
    return supportedTypes.some(type => filename.toLowerCase().endsWith(type));
  }

  /**
   * Process resume files (PDF, DOCX) with comprehensive data extraction
   */
  static async processResumes(files: { buffer: Buffer; filename: string }[]): Promise<ProcessedCandidate[]> {
    try {
      console.log('=== FILE PROCESSOR: Processing Resume Files ===');
      console.log('Files to process:', files.map(f => f.filename));
      
      const resumeData = await ResumeParser.parseMultipleResumes(files);
      
      // Save extracted data to database
      const savedData = [];
      for (const data of resumeData) {
        try {
          const saved = await ResumeDataService.saveResumeData(
            data.extractedData,
            files.find(f => f.filename.includes(data.extractedData.name || 'unknown'))?.filename || 'unknown',
            data.processingTime,
            data.confidence
          );
          savedData.push(saved);
          console.log(`Saved resume data for ${data.extractedData.name}:`, saved);
        } catch (saveError) {
          console.error(`Failed to save resume data for ${data.extractedData.name}:`, saveError);
        }
      }
      
      // Convert comprehensive resume data to ProcessedCandidate format
      const processedCandidates = resumeData.map(data => {
        const comprehensive = data.extractedData;
        
        // Create a ProcessedCandidate with comprehensive data stored in originalData
        const candidate: ProcessedCandidate = {
          name: comprehensive.name,
          email: comprehensive.email,
          title: comprehensive.title,
          company: comprehensive.experience?.[0]?.company || undefined,
          skills: comprehensive.skills,
          linkedinUrl: comprehensive.linkedinUrl,
          location: comprehensive.location,
          phone: comprehensive.phone,
          experience: comprehensive.experience?.[0]?.duration || undefined,
          // Store comprehensive data in originalData
          originalData: {
            ...comprehensive,
            rawText: data.rawText.substring(0, 1000) // Store excerpt
          },
          source: 'resume',
          confidence: data.confidence,
          processingTime: data.processingTime
        };

        return candidate;
      });

      console.log('=== FILE PROCESSOR: Final Processed Candidates ===');
      console.log('Number of candidates processed:', processedCandidates.length);
      console.log('Number of candidates saved to database:', savedData.length);
      processedCandidates.forEach((candidate, index) => {
        console.log(`Candidate ${index + 1}:`, JSON.stringify(candidate, null, 2));
      });
      console.log('=== END FILE PROCESSOR ===');

      return processedCandidates;
    } catch (error) {
      throw new Error(`Resume processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Determine file type and process accordingly
   */
  static async processFile(buffer: Buffer, filename: string): Promise<ProcessedCandidate[]> {
    if (!this.validateFileType(filename)) {
      throw new Error(`Unsupported file type. Supported types: ${this.getSupportedFileTypes().join(', ')}`);
    }

    const lowerFilename = filename.toLowerCase();
    
    if (lowerFilename.endsWith('.csv')) {
      return this.processCSV(buffer);
    } else if (lowerFilename.endsWith('.xlsx') || lowerFilename.endsWith('.xls')) {
      return this.processExcel(buffer);
    } else if (lowerFilename.endsWith('.pdf') || lowerFilename.endsWith('.docx')) {
      const candidates = await this.processResumes([{ buffer, filename }]);
      return candidates;
    }

    throw new Error('Unable to determine file type');
  }
}
