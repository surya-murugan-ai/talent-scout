import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

export interface ProcessedCandidate {
  name: string;
  email?: string;
  title?: string;
  company?: string;
  skills?: string[];
  linkedinUrl?: string;
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
    // Common field mappings for different data formats
    const fieldMappings = {
      name: ['name', 'full_name', 'candidate_name', 'fullname', 'Name', 'Full Name'],
      email: ['email', 'email_address', 'Email', 'Email Address'],
      title: ['title', 'job_title', 'position', 'role', 'Title', 'Job Title', 'Position'],
      company: ['company', 'employer', 'current_company', 'Company', 'Employer', 'Current Company'],
      skills: ['skills', 'skill_set', 'technologies', 'Skills', 'Technologies'],
      linkedinUrl: ['linkedin', 'linkedin_url', 'linkedinUrl', 'LinkedIn', 'LinkedIn URL']
    };

    const candidate: ProcessedCandidate = { name: '' };

    Object.entries(fieldMappings).forEach(([standardField, possibleFields]) => {
      const value = possibleFields.find(field => rawData[field] !== undefined && rawData[field] !== null);
      if (value) {
        if (standardField === 'skills' && typeof rawData[value] === 'string') {
          // Parse skills from string (comma or semicolon separated)
          candidate[standardField] = rawData[value]
            .split(/[,;]/)
            .map((skill: string) => skill.trim())
            .filter((skill: string) => skill.length > 0);
        } else {
          candidate[standardField] = rawData[value];
        }
      }
    });

    // Store original data for reference
    candidate.originalData = rawData;

    return candidate;
  }

  static getSupportedFileTypes(): string[] {
    return ['.csv', '.xlsx', '.xls'];
  }

  static validateFileType(filename: string): boolean {
    const supportedTypes = this.getSupportedFileTypes();
    return supportedTypes.some(type => filename.toLowerCase().endsWith(type));
  }

  static async processFile(buffer: Buffer, filename: string): Promise<ProcessedCandidate[]> {
    if (!this.validateFileType(filename)) {
      throw new Error(`Unsupported file type. Supported types: ${this.getSupportedFileTypes().join(', ')}`);
    }

    const lowerFilename = filename.toLowerCase();
    
    if (lowerFilename.endsWith('.csv')) {
      return this.processCSV(buffer);
    } else if (lowerFilename.endsWith('.xlsx') || lowerFilename.endsWith('.xls')) {
      return this.processExcel(buffer);
    }

    throw new Error('Unable to determine file type');
  }
}
