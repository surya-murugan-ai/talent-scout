import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const candidates = pgTable("candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  company: text("company"), // Company from resume
  currentEmployer: text("current_employer"), // Current company from LinkedIn
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  location: text("location"),
  linkedinLastActive: timestamp("linkedin_last_active"), // Last active date on LinkedIn
  skills: jsonb("skills").default([]),
  score: real("score").default(0),
  priority: text("priority").default("Low"), // High, Medium, Low
  openToWork: boolean("open_to_work").default(false),
  lastActive: text("last_active"),
  notes: text("notes"),
  linkedinNotes: text("linkedin_notes"), // Notes from recent posts/comments
  
<<<<<<< HEAD
  // Enhanced fields for better data extraction
  firstName: text("first_name"),
  lastName: text("last_name"),
  middleName: text("middle_name"),
  currentTitle: text("current_title"),
  currentCompany: text("current_company"),
  yearsOfExperience: real("years_of_experience"),
  education: jsonb("education").default([]), // Array of education objects
  workHistory: jsonb("work_history").default([]), // Array of work history objects
  certifications: jsonb("certifications").default([]), // Array of certification objects
  languages: jsonb("languages").default([]), // Array of languages
  salary: text("salary"),
  availability: text("availability"),
  remotePreference: text("remote_preference"),
  visaStatus: text("visa_status"),
  linkedinHeadline: text("linkedin_headline"),
  linkedinSummary: text("linkedin_summary"),
  linkedinConnections: integer("linkedin_connections"),
  
  // Contact information
  alternateEmail: text("alternate_email"),
  website: text("website"),
  github: text("github"),
  portfolio: text("portfolio"),
  
  // Additional metadata
  sourceFile: text("source_file"),
  processingDate: timestamp("processing_date"),
  dataQuality: real("data_quality"), // 0-100 score of data completeness
=======
  // Company comparison and hireability fields
  companyDifference: text("company_difference"), // Difference between resume company and LinkedIn company
  companyDifferenceScore: real("company_difference_score").default(0), // Score for company difference (0-10)
  hireabilityScore: real("hireability_score").default(0), // Overall hireability score (0-10)
  hireabilityFactors: jsonb("hireability_factors").default([]), // Factors affecting hireability
  potentialToJoin: text("potential_to_join").default("Unknown"), // High, Medium, Low, Unknown
>>>>>>> f1a54160bf1416a973abca96f0a46d4353508e89
  
  // ATS History fields
  atsId: text("ats_id"), // ID from ATS system
  selectionStatus: text("selection_status"), // Offered, Selected, etc.
  selectionDate: timestamp("selection_date"),
  joiningOutcome: text("joining_outcome"), // Declined, Dropped, No Communication
  atsNotes: text("ats_notes"), // Additional notes from ATS
  
  // Source tracking
  source: text("source").default("upload"), // upload, ats, manual, apify
  
  // Resume extraction data
  originalData: jsonb("original_data"),
  enrichedData: jsonb("enriched_data"),
  extractedData: jsonb("extracted_data"), // Structured extracted data
  confidence: real("confidence").default(0),
  processingTime: integer("processing_time").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// New table for storing detailed resume data
export const resumeData = pgTable("resume_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").references(() => candidates.id),
  filename: text("filename").notNull(),
  
  // Basic Info
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  location: text("location"),
  title: text("title"),
  summary: text("summary"),
  
  // Structured Data
  experience: jsonb("experience").default([]),
  education: jsonb("education").default([]),
  projects: jsonb("projects").default([]),
  achievements: jsonb("achievements").default([]),
  certifications: jsonb("certifications").default([]),
  skills: jsonb("skills").default([]),
  interests: jsonb("interests").default([]),
  languages: jsonb("languages").default([]),
  
  // Metadata
  rawText: text("raw_text"),
  confidence: real("confidence").default(0),
  processingTime: integer("processing_time").default(0),
  source: text("source").default("resume"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"), // active, completed, archived
  totalCandidates: integer("total_candidates").default(0),
  processedCandidates: integer("processed_candidates").default(0),
  scoringWeights: jsonb("scoring_weights").default({
    openToWork: 30,
    skillMatch: 25,
    jobStability: 15,
    engagement: 15,
    companyDifference: 15
  }),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const processingJobs = pgTable("processing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  status: text("status").default("pending"), // pending, processing, completed, failed
  progress: integer("progress").default(0),
  totalRecords: integer("total_records").default(0),
  processedRecords: integer("processed_records").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // upload, processing, export, scoring_update
  message: text("message").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertCandidateSchema = createInsertSchema(candidates).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true
});
export const insertResumeDataSchema = createInsertSchema(resumeData).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true
});

export const insertProjectSchema = createInsertSchema(projects).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertProcessingJobSchema = createInsertSchema(processingJobs).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertActivitySchema = createInsertSchema(activities).omit({ 
  id: true, 
  createdAt: true 
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type ResumeData = typeof resumeData.$inferSelect;
export type InsertResumeData = z.infer<typeof insertResumeDataSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type InsertProcessingJob = z.infer<typeof insertProcessingJobSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

// Additional schemas for API requests
export const scoringWeightsSchema = z.object({
  openToWork: z.number().min(0).max(100),
  skillMatch: z.number().min(0).max(100),
  jobStability: z.number().min(0).max(100),
  engagement: z.number().min(0).max(100),
  companyDifference: z.number().min(0).max(100), // New factor for company difference
});

export type ScoringWeights = z.infer<typeof scoringWeightsSchema>;
