import { users, candidates, projects, processingJobs, activities, scoringConfigs } from "@shared/schema";
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, and, sql, gte, lte, like, inArray } from 'drizzle-orm';
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
    async getCandidates(comId, limit = 50, offset = 0) {
        const result = await db.select()
            .from(candidates)
            .where(and(eq(candidates.comId, comId), eq(candidates.resumeStatus, 'active')))
            .orderBy(desc(candidates.score))
            .limit(limit)
            .offset(offset);
        return result;
    }
    async getCandidate(id, comId) {
        let whereCondition = eq(candidates.id, id);
        if (comId) {
            whereCondition = and(eq(candidates.id, id), eq(candidates.comId, comId));
        }
        const result = await db.select().from(candidates).where(whereCondition).limit(1);
        return result[0];
    }
    async getCandidateByEmail(email, comId) {
        const result = await db.select()
            .from(candidates)
            .where(and(eq(candidates.email, email), eq(candidates.comId, comId)))
            .limit(1);
        return result[0];
    }
    async createCandidate(insertCandidate) {
        const result = await db.insert(candidates).values(insertCandidate).returning();
        return result[0];
    }
    async updateCandidate(id, updates) {
        const result = await db.update(candidates)
            .set(updates)
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
            .where(and(eq(candidates.priority, priority), eq(candidates.resumeStatus, 'active')))
            .orderBy(desc(candidates.score));
        return result;
    }
    // Enhanced candidate queries
    async getCandidatesBySkills(skills) {
        // Search for candidates with any of the specified skills
        const skillConditions = skills.map(skill => sql `${candidates.skills}::text ILIKE ${`%${skill}%`}`);
        const result = await db.select()
            .from(candidates)
            .where(and(sql `(${skillConditions.join(' OR ')})`, eq(candidates.resumeStatus, 'active')))
            .orderBy(desc(candidates.score));
        return result;
    }
    async getCandidatesByExperience(minYears, maxYears) {
        let conditions = [
            gte(candidates.yearsOfExperience, minYears),
            eq(candidates.resumeStatus, 'active')
        ];
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
            .where(and(gte(candidates.dataQuality, minQuality), eq(candidates.resumeStatus, 'active')))
            .orderBy(desc(candidates.dataQuality));
        return result;
    }
    async getCandidatesByLocation(location) {
        const result = await db.select()
            .from(candidates)
            .where(and(like(candidates.location, `%${location}%`), eq(candidates.resumeStatus, 'active')))
            .orderBy(desc(candidates.score));
        return result;
    }
    async getCandidatesByCompany(company) {
        const result = await db.select()
            .from(candidates)
            .where(and(sql `(${candidates.company} ILIKE ${`%${company}%`} OR ${candidates.currentCompany} ILIKE ${`%${company}%`})`, eq(candidates.resumeStatus, 'active')))
            .orderBy(desc(candidates.score));
        return result;
    }
    async searchCandidates(query) {
        const searchTerm = `%${query}%`;
        const result = await db.select()
            .from(candidates)
            .where(and(sql `(
          ${candidates.name} ILIKE ${searchTerm} OR
          ${candidates.title} ILIKE ${searchTerm} OR
          ${candidates.company} ILIKE ${searchTerm} OR
          ${candidates.currentCompany} ILIKE ${searchTerm} OR
          ${candidates.location} ILIKE ${searchTerm} OR
          ${candidates.skills}::text ILIKE ${searchTerm}
        )`, eq(candidates.resumeStatus, 'active')))
            .orderBy(desc(candidates.score));
        return result;
    }
    async getCandidatesBySource(source) {
        const result = await db.select()
            .from(candidates)
            .where(and(eq(candidates.source, source), eq(candidates.resumeStatus, 'active')))
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
    // Scoring Configuration methods
    async getScoringConfig(comId) {
        try {
            const result = await db.select()
                .from(scoringConfigs)
                .where(eq(scoringConfigs.comId, comId))
                .limit(1);
            return result[0];
        }
        catch (error) {
            console.error('Error fetching scoring config:', error);
            return undefined;
        }
    }
    async createScoringConfig(config) {
        const result = await db.insert(scoringConfigs).values(config).returning();
        return result[0];
    }
    async updateScoringConfig(comId, config) {
        try {
            const result = await db.update(scoringConfigs)
                .set({ ...config, updatedAt: new Date() })
                .where(eq(scoringConfigs.comId, comId))
                .returning();
            return result[0];
        }
        catch (error) {
            console.error('Error updating scoring config:', error);
            return undefined;
        }
    }
    // Eeezo-specific methods
    async getCandidatesByCompanyId(comId, options = {}) {
        try {
            let whereCondition = and(eq(candidates.comId, comId), eq(candidates.resumeStatus, 'active'));
            if (options.status) {
                whereCondition = and(eq(candidates.comId, comId), eq(candidates.eeezoStatus, options.status), eq(candidates.resumeStatus, 'active'));
            }
            const query = db.select().from(candidates)
                .where(whereCondition)
                .orderBy(desc(candidates.createdAt))
                .limit(options.limit || 100)
                .offset(options.offset || 0);
            return await query;
        }
        catch (error) {
            console.error('Error fetching candidates by company ID:', error);
            throw new Error(`Failed to fetch candidates: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getCandidatesByIds(candidateIds, comId) {
        try {
            if (candidateIds.length === 0) {
                return [];
            }
            const result = await db.select()
                .from(candidates)
                .where(and(inArray(candidates.id, candidateIds), eq(candidates.comId, comId), eq(candidates.resumeStatus, 'active')))
                .orderBy(desc(candidates.createdAt));
            return result;
        }
        catch (error) {
            console.error('Error fetching candidates by IDs:', error);
            throw new Error(`Failed to fetch candidates: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getEeezoProcessingStatus(comId) {
        try {
            const result = await db.select({
                eeezoStatus: candidates.eeezoStatus,
                enrichmentStatus: candidates.enrichmentStatus,
                count: sql `count(*)`
            })
                .from(candidates)
                .where(eq(candidates.comId, comId))
                .groupBy(candidates.eeezoStatus, candidates.enrichmentStatus);
            const status = {
                totalCandidates: 0,
                uploaded: 0,
                processed: 0,
                enriched: 0,
                completed: 0,
                pendingEnrichment: 0,
                failedEnrichment: 0
            };
            result.forEach(candidate => {
                status.totalCandidates += candidate.count;
                switch (candidate.eeezoStatus) {
                    case 'uploaded':
                        status.uploaded += candidate.count;
                        break;
                    case 'processed':
                        status.processed += candidate.count;
                        break;
                    case 'enriched':
                        status.enriched += candidate.count;
                        break;
                    case 'completed':
                        status.completed += candidate.count;
                        break;
                }
                switch (candidate.enrichmentStatus) {
                    case 'pending':
                        status.pendingEnrichment += candidate.count;
                        break;
                    case 'failed':
                        status.failedEnrichment += candidate.count;
                        break;
                }
            });
            return status;
        }
        catch (error) {
            console.error('Error fetching Eeezo status:', error);
            throw new Error(`Failed to fetch status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async updateCandidateEeezoStatus(candidateId, updateData) {
        try {
            const [updatedCandidate] = await db.update(candidates)
                .set({
                eeezoStatus: updateData.eeezoStatus,
                notes: updateData.notes
            })
                .where(eq(candidates.id, candidateId))
                .returning();
            // Log activity
            await db.insert(activities).values({
                type: 'eezo_status_update',
                message: `Eeezo status updated for candidate ${candidateId}`,
                details: `Status: ${updateData.eeezoStatus}, Notes: ${updateData.notes || 'None'}`
            });
            return updatedCandidate;
        }
        catch (error) {
            console.error('Error updating candidate Eeezo status:', error);
            throw new Error(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async updateCandidateResumeStatus(candidateId, status, comId) {
        try {
            let whereCondition = eq(candidates.id, candidateId);
            if (comId) {
                whereCondition = and(eq(candidates.id, candidateId), eq(candidates.comId, comId));
            }
            const [updatedCandidate] = await db.update(candidates)
                .set({
                resumeStatus: status
            })
                .where(whereCondition)
                .returning();
            if (!updatedCandidate) {
                return undefined;
            }
            // Log activity
            await db.insert(activities).values({
                type: 'resume_status_update',
                message: `Resume status updated to ${status} for candidate ${candidateId}`,
                details: `Candidate: ${updatedCandidate?.name || 'Unknown'}, Status: ${status}, Company: ${comId || 'Unknown'}`
            });
            return updatedCandidate;
        }
        catch (error) {
            console.error('Error updating candidate resume status:', error);
            throw new Error(`Failed to update resume status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getCandidatesByResumeStatus(status, comId, limit = 100, offset = 0) {
        try {
            const result = await db.select()
                .from(candidates)
                .where(and(eq(candidates.resumeStatus, status), eq(candidates.comId, comId)))
                .orderBy(desc(candidates.createdAt))
                .limit(limit)
                .offset(offset);
            return result;
        }
        catch (error) {
            console.error('Error fetching candidates by resume status:', error);
            throw new Error(`Failed to fetch candidates: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Clear data methods
    async clearAllCandidates() {
        // Clear candidates
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
