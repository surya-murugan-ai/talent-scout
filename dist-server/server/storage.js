import { users, candidates, projects, processingJobs, activities, resumeData } from "@shared/schema";
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, and, sql, gte, lte, like } from 'drizzle-orm';
const neonSql = neon(process.env.DATABASE_URL);
const db = drizzle(neonSql);
export class PostgresStorage {
    constructor() {
        // Initialize default project if it doesn't exist
        this.initializeDefaultData();
    }
    async initializeDefaultData() {
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
        }
        catch (error) {
            console.error("Error initializing default data:", error);
        }
    }
    // Users
    async getUser(id) {
        const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
        return result[0];
    }
    async getUserByUsername(username) {
        const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
        return result[0];
    }
    async createUser(insertUser) {
        const result = await db.insert(users).values(insertUser).returning();
        return result[0];
    }
    // Candidates
    async getCandidates(limit = 50, offset = 0) {
        const result = await db.select()
            .from(candidates)
            .orderBy(desc(candidates.score))
            .limit(limit)
            .offset(offset);
        return result;
    }
    async getCandidate(id) {
        const result = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
        return result[0];
    }
    async getCandidateByEmail(email) {
        const result = await db.select().from(candidates).where(eq(candidates.email, email)).limit(1);
        return result[0];
    }
    async createCandidate(insertCandidate) {
        const result = await db.insert(candidates).values(insertCandidate).returning();
        return result[0];
    }
    async updateCandidate(id, updates) {
        const result = await db.update(candidates)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(candidates.id, id))
            .returning();
        return result[0];
    }
    async deleteCandidate(id) {
        const result = await db.delete(candidates).where(eq(candidates.id, id)).returning();
        return result.length > 0;
    }
    async deleteProcessingJob(id) {
        const result = await db.delete(processingJobs).where(eq(processingJobs.id, id)).returning();
        return result.length > 0;
    }
    async getCandidatesByPriority(priority) {
        const result = await db.select()
            .from(candidates)
            .where(eq(candidates.priority, priority))
            .orderBy(desc(candidates.score));
        return result;
    }
    // Enhanced candidate queries
    async getCandidatesBySkills(skills) {
        // Search for candidates with any of the specified skills
        const skillConditions = skills.map(skill => sql `${candidates.skills}::text ILIKE ${`%${skill}%`}`);
        const result = await db.select()
            .from(candidates)
            .where(sql `(${skillConditions.join(' OR ')})`)
            .orderBy(desc(candidates.score));
        return result;
    }
    async getCandidatesByExperience(minYears, maxYears) {
        let conditions = [gte(candidates.yearsOfExperience, minYears)];
        if (maxYears) {
            conditions.push(lte(candidates.yearsOfExperience, maxYears));
        }
        const result = await db.select()
            .from(candidates)
            .where(and(...conditions))
            .orderBy(desc(candidates.score));
        return result;
    }
    async getCandidatesByDataQuality(minQuality) {
        const result = await db.select()
            .from(candidates)
            .where(gte(candidates.dataQuality, minQuality))
            .orderBy(desc(candidates.dataQuality));
        return result;
    }
    async getCandidatesByLocation(location) {
        const result = await db.select()
            .from(candidates)
            .where(like(candidates.location, `%${location}%`))
            .orderBy(desc(candidates.score));
        return result;
    }
    async getCandidatesByCompany(company) {
        const result = await db.select()
            .from(candidates)
            .where(sql `(${candidates.company} ILIKE ${`%${company}%`} OR ${candidates.currentCompany} ILIKE ${`%${company}%`})`)
            .orderBy(desc(candidates.score));
        return result;
    }
    async searchCandidates(query) {
        const searchTerm = `%${query}%`;
        const result = await db.select()
            .from(candidates)
            .where(sql `(
          ${candidates.name} ILIKE ${searchTerm} OR
          ${candidates.title} ILIKE ${searchTerm} OR
          ${candidates.company} ILIKE ${searchTerm} OR
          ${candidates.currentCompany} ILIKE ${searchTerm} OR
          ${candidates.location} ILIKE ${searchTerm} OR
          ${candidates.skills}::text ILIKE ${searchTerm}
        )`)
            .orderBy(desc(candidates.score));
        return result;
    }
    async getCandidatesBySource(source) {
        const result = await db.select()
            .from(candidates)
            .where(eq(candidates.source, source))
            .orderBy(desc(candidates.createdAt));
        return result;
    }
    async getCandidatesStats() {
        try {
            const totalResult = await db.select({ count: sql `cast(count(*) as integer)` }).from(candidates);
            const highPriorityResult = await db.select({ count: sql `cast(count(*) as integer)` })
                .from(candidates)
                .where(eq(candidates.priority, 'High'));
            const processingResult = await db.select({ count: sql `cast(count(*) as integer)` })
                .from(processingJobs)
                .where(eq(processingJobs.status, 'processing'));
            const avgScoreResult = await db.select({ avg: sql `cast(coalesce(avg(score), 0) as decimal(10,1))` })
                .from(candidates)
                .where(sql `score > 0`);
            return {
                total: totalResult[0]?.count || 0,
                highPriority: highPriorityResult[0]?.count || 0,
                processing: processingResult[0]?.count || 0,
                avgScore: Math.round((avgScoreResult[0]?.avg || 0) * 10) / 10
            };
        }
        catch (error) {
            console.error("Error fetching stats:", error);
            return { total: 0, highPriority: 0, processing: 0, avgScore: 0 };
        }
    }
    // Projects
    async getProjects() {
        const result = await db.select().from(projects);
        return result;
    }
    async getProject(id) {
        const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
        return result[0];
    }
    async createProject(insertProject) {
        const result = await db.insert(projects).values(insertProject).returning();
        return result[0];
    }
    async updateProject(id, updates) {
        const result = await db.update(projects)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(projects.id, id))
            .returning();
        return result[0];
    }
    // Processing Jobs
    async getProcessingJobs() {
        const result = await db.select().from(processingJobs).orderBy(desc(processingJobs.createdAt));
        return result;
    }
    async getProcessingJob(id) {
        const result = await db.select().from(processingJobs).where(eq(processingJobs.id, id)).limit(1);
        return result[0];
    }
    async createProcessingJob(insertProcessingJob) {
        const result = await db.insert(processingJobs).values(insertProcessingJob).returning();
        return result[0];
    }
    async updateProcessingJob(id, updates) {
        const result = await db.update(processingJobs)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(processingJobs.id, id))
            .returning();
        return result[0];
    }
    async getActiveProcessingJobs() {
        const result = await db.select()
            .from(processingJobs)
            .where(eq(processingJobs.status, 'processing'))
            .orderBy(desc(processingJobs.createdAt));
        return result;
    }
    // Activities
    async getRecentActivities(limit = 50) {
        const result = await db.select()
            .from(activities)
            .orderBy(desc(activities.createdAt))
            .limit(limit);
        return result;
    }
    async createActivity(insertActivity) {
        const result = await db.insert(activities).values(insertActivity).returning();
        return result[0];
    }
    // Clear data methods
    async clearAllCandidates() {
        // Clear resume data first due to foreign key constraints
        await db.delete(resumeData);
        // Then clear candidates
        await db.delete(candidates);
    }
    async clearAllProcessingJobs() {
        await db.delete(processingJobs);
    }
    async clearAllActivities() {
        await db.delete(activities);
    }
}
export const storage = new PostgresStorage();
