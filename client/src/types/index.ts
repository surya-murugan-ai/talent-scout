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
  email?: string;
  title?: string;
  company?: string;
  currentEmployer?: string;
  linkedinUrl?: string;
  skills?: string[];
  score?: number;
  priority: 'High' | 'Medium' | 'Low';
  openToWork: boolean;
  lastActive?: string;
  notes?: string;
  
  // Company comparison and hireability fields
  companyDifference?: string;
  companyDifferenceScore?: number;
  hireabilityScore?: number;
  hireabilityFactors?: string[];
  potentialToJoin?: 'High' | 'Medium' | 'Low' | 'Unknown';
  
  createdAt?: string;
  updatedAt?: string;
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
  updatedAt?: string;
}

export interface Activity {
  id: string;
  type: 'upload' | 'processing' | 'export' | 'scoring_update';
  message: string;
  details?: string;
  createdAt?: string;
}
