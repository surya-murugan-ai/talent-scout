// Re-export types from shared schema
export type { Candidate, InsertCandidate, User, Activity, Project, ProcessingJob } from "@shared/schema";

// Additional frontend-specific types
export interface LinkedInProfile {
  title: string;
  company: string;
  skills: string[];
  openToWork: boolean;
  lastActive: string;
  recentPosts: string[];
  connections: number;
  profileStrength: string;
}

export interface CandidateAnalysis {
  overallScore: number;
  priority: "High" | "Medium" | "Low";
  insights: string[];
  openToWorkSignals: string[];
  skillMatchScore: number;
  jobStabilityScore: number;
  engagementScore: number;
}

export interface FileProcessorCandidate {
  name: string;
  email?: string;
  title?: string;
  company?: string;
  skills?: string;
  experience?: string;
  education?: string;
  linkedinUrl?: string;
}

export interface Stats {
  total: number;
  highPriority: number;
  processing: number;
  avgScore: number;
}