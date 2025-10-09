export interface Stats {
  total: number;
  highPriority: number;
  processing: number;
  avgScore: number;
}

export interface ScoringWeights {
  openToWork: number;
  skillMatch: number;
  jobStability: number;
  engagement: number;
  companyDifference: number;
}

export interface Candidate {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  company?: string | null;
  currentEmployer?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  location?: string | null;
  skills?: string[];
  score?: number;
  priority: 'High' | 'Medium' | 'Low';
  openToWork: boolean;
  lastActive?: string | null;
  notes?: string | null;
  
  // Company comparison and hireability fields
  companyDifference?: string;
  companyDifferenceScore?: number;
  hireabilityScore?: number;
  hireabilityFactors?: string[];
  potentialToJoin?: 'High' | 'Medium' | 'Low' | 'Unknown';
  
  // Additional fields for comprehensive data
  originalData?: any;
  extractedData?: any;
  enrichedData?: any;
  confidence?: number;
  processingTime?: number;
  source?: string | null;
  
  createdAt?: string | null;
}

export interface ProcessingJob {
  id: string;
  projectId?: string;
  fileName: string;
  fileSize?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRecords: number;
  processedRecords: number;
  errorMessage?: string;
  createdAt?: string;
}

export interface Activity {
  id: string;
  type: 'upload' | 'processing' | 'export' | 'scoring_update';
  message: string;
  details?: string;
  createdAt?: string;
}
