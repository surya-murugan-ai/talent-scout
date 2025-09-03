import { 
  type User, 
  type InsertUser,
  type Candidate,
  type InsertCandidate,
  type Project,
  type InsertProject,
  type ProcessingJob,
  type InsertProcessingJob,
  type Activity,
  type InsertActivity,
  users,
  candidates,
  projects,
  processingJobs,
  activities
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, and, sql, gte, lte, like, inArray } from 'drizzle-orm';

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql);

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Candidates
  getCandidates(limit?: number, offset?: number): Promise<Candidate[]>;
  getCandidate(id: string): Promise<Candidate | undefined>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  updateCandidate(id: string, candidate: Partial<Candidate>): Promise<Candidate | undefined>;
  deleteCandidate(id: string): Promise<boolean>;
  getCandidatesByPriority(priority: string): Promise<Candidate[]>;
  getCandidatesStats(): Promise<{
    total: number;
    highPriority: number;
    processing: number;
    avgScore: number;
  }>;

  // Enhanced candidate queries
  getCandidatesBySkills(skills: string[]): Promise<Candidate[]>;
  getCandidatesByExperience(minYears: number, maxYears?: number): Promise<Candidate[]>;
  getCandidatesByDataQuality(minQuality: number): Promise<Candidate[]>;
  getCandidatesByLocation(location: string): Promise<Candidate[]>;
  getCandidatesByCompany(company: string): Promise<Candidate[]>;
  searchCandidates(query: string): Promise<Candidate[]>;
  getCandidatesBySource(source: string): Promise<Candidate[]>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<Project>): Promise<Project | undefined>;

  // Processing Jobs
  getProcessingJobs(): Promise<ProcessingJob[]>;
  getProcessingJob(id: string): Promise<ProcessingJob | undefined>;
  createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob>;
  updateProcessingJob(id: string, job: Partial<ProcessingJob>): Promise<ProcessingJob | undefined>;
  getActiveProcessingJobs(): Promise<ProcessingJob[]>;

  // Activities
  getRecentActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
}

export class PostgresStorage implements IStorage {
  constructor() {
    // Initialize default project if it doesn't exist
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    try {
      // Check if default project exists
      const existingProject = await db.select().from(projects).where(eq(projects.id, "default-project")).limit(1);
      
      if (existingProject.length === 0) {
        await db.insert(projects).values({
          id: "default-project",
          name: "Main Talent Pipeline",
          description: "Primary candidate processing pipeline",
          status: "active",
          totalCandidates: 0,
          processedCandidates: 0,
          scoringWeights: {
            openToWork: 40,
            skillMatch: 30,
            jobStability: 15,
            engagement: 15
          }
        });
      }
    } catch (error) {
      console.error("Error initializing default data:", error);
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Candidates
  async getCandidates(limit = 50, offset = 0): Promise<Candidate[]> {
    const result = await db.select()
      .from(candidates)
      .orderBy(desc(candidates.score))
      .limit(limit)
      .offset(offset);
    return result;
  }

  async getCandidate(id: string): Promise<Candidate | undefined> {
    const result = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
    return result[0];
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const result = await db.insert(candidates).values(insertCandidate).returning();
    return result[0];
  }

  async updateCandidate(id: string, updates: Partial<Candidate>): Promise<Candidate | undefined> {
    const result = await db.update(candidates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(candidates.id, id))
      .returning();
    return result[0];
  }

  async deleteCandidate(id: string): Promise<boolean> {
    const result = await db.delete(candidates).where(eq(candidates.id, id)).returning();
    return result.length > 0;
  }

  async deleteProcessingJob(id: string): Promise<boolean> {
    const result = await db.delete(processingJobs).where(eq(processingJobs.id, id)).returning();
    return result.length > 0;
  }

  async getCandidatesByPriority(priority: string): Promise<Candidate[]> {
    const result = await db.select()
      .from(candidates)
      .where(eq(candidates.priority, priority))
      .orderBy(desc(candidates.score));
    return result;
  }

  // Enhanced candidate queries
  async getCandidatesBySkills(skills: string[]): Promise<Candidate[]> {
    // Search for candidates with any of the specified skills
    const skillConditions = skills.map(skill => 
      sql`${candidates.skills}::text ILIKE ${`%${skill}%`}`
    );
    
    const result = await db.select()
      .from(candidates)
      .where(sql`(${skillConditions.join(' OR ')})`)
      .orderBy(desc(candidates.score));
    
    return result;
  }

  async getCandidatesByExperience(minYears: number, maxYears?: number): Promise<Candidate[]> {
    let query = db.select()
      .from(candidates)
      .where(gte(candidates.yearsOfExperience, minYears));
    
    if (maxYears) {
      query = query.where(lte(candidates.yearsOfExperience, maxYears));
    }
    
    const result = await query.orderBy(desc(candidates.score));
    return result;
  }

  async getCandidatesByDataQuality(minQuality: number): Promise<Candidate[]> {
    const result = await db.select()
      .from(candidates)
      .where(gte(candidates.dataQuality, minQuality))
      .orderBy(desc(candidates.dataQuality));
    
    return result;
  }

  async getCandidatesByLocation(location: string): Promise<Candidate[]> {
    const result = await db.select()
      .from(candidates)
      .where(like(candidates.location, `%${location}%`))
      .orderBy(desc(candidates.score));
    
    return result;
  }

  async getCandidatesByCompany(company: string): Promise<Candidate[]> {
    const result = await db.select()
      .from(candidates)
      .where(
        sql`(${candidates.company} ILIKE ${`%${company}%`} OR ${candidates.currentCompany} ILIKE ${`%${company}%`})`
      )
      .orderBy(desc(candidates.score));
    
    return result;
  }

  async searchCandidates(query: string): Promise<Candidate[]> {
    const searchTerm = `%${query}%`;
    const result = await db.select()
      .from(candidates)
      .where(
        sql`(
          ${candidates.name} ILIKE ${searchTerm} OR
          ${candidates.title} ILIKE ${searchTerm} OR
          ${candidates.company} ILIKE ${searchTerm} OR
          ${candidates.currentCompany} ILIKE ${searchTerm} OR
          ${candidates.location} ILIKE ${searchTerm} OR
          ${candidates.skills}::text ILIKE ${searchTerm}
        )`
      )
      .orderBy(desc(candidates.score));
    
    return result;
  }

  async getCandidatesBySource(source: string): Promise<Candidate[]> {
    const result = await db.select()
      .from(candidates)
      .where(eq(candidates.source, source))
      .orderBy(desc(candidates.createdAt));
    
    return result;
  }

  async getCandidatesStats(): Promise<{
    total: number;
    highPriority: number;
    processing: number;
    avgScore: number;
  }> {
    try {
      const totalResult = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(candidates);
      const highPriorityResult = await db.select({ count: sql<number>`cast(count(*) as integer)` })
        .from(candidates)
        .where(eq(candidates.priority, 'High'));
      const processingResult = await db.select({ count: sql<number>`cast(count(*) as integer)` })
        .from(processingJobs)
        .where(eq(processingJobs.status, 'processing'));
      const avgScoreResult = await db.select({ avg: sql<number>`cast(coalesce(avg(score), 0) as decimal(10,1))` })
        .from(candidates)
        .where(sql`score > 0`);

      return {
        total: totalResult[0]?.count || 0,
        highPriority: highPriorityResult[0]?.count || 0,
        processing: processingResult[0]?.count || 0,
        avgScore: Math.round((avgScoreResult[0]?.avg || 0) * 10) / 10
      };
    } catch (error) {
      console.error("Error fetching stats:", error);
      return { total: 0, highPriority: 0, processing: 0, avgScore: 0 };
    }
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    const result = await db.select().from(projects);
    return result;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(insertProject).returning();
    return result[0];
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const result = await db.update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  // Processing Jobs
  async getProcessingJobs(): Promise<ProcessingJob[]> {
    const result = await db.select().from(processingJobs).orderBy(desc(processingJobs.createdAt));
    return result;
  }

  async getProcessingJob(id: string): Promise<ProcessingJob | undefined> {
    const result = await db.select().from(processingJobs).where(eq(processingJobs.id, id)).limit(1);
    return result[0];
  }

  async createProcessingJob(insertProcessingJob: InsertProcessingJob): Promise<ProcessingJob> {
    const result = await db.insert(processingJobs).values(insertProcessingJob).returning();
    return result[0];
  }

  async updateProcessingJob(id: string, updates: Partial<ProcessingJob>): Promise<ProcessingJob | undefined> {
    const result = await db.update(processingJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(processingJobs.id, id))
      .returning();
    return result[0];
  }

  async getActiveProcessingJobs(): Promise<ProcessingJob[]> {
    const result = await db.select()
      .from(processingJobs)
      .where(eq(processingJobs.status, 'processing'))
      .orderBy(desc(processingJobs.createdAt));
    return result;
  }

  // Activities
  async getRecentActivities(limit = 50): Promise<Activity[]> {
    const result = await db.select()
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(limit);
    return result;
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const result = await db.insert(activities).values(insertActivity).returning();
    return result[0];
  }
}

export const storage = new PostgresStorage();
