import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
const neonSql = neon(process.env.DATABASE_URL);
const db = drizzle(neonSql);
export async function checkDatabaseHealth() {
    try {
        // Test database connection
        await db.execute(sql `SELECT 1`);
        // Check table counts and status
        const candidatesResult = await db.execute(sql `SELECT COUNT(*) as count FROM candidates`);
        const projectsResult = await db.execute(sql `SELECT COUNT(*) as count FROM projects`);
        const jobsResult = await db.execute(sql `SELECT COUNT(*) as count FROM processing_jobs`);
        const activitiesResult = await db.execute(sql `SELECT COUNT(*) as count FROM activities`);
        const usersResult = await db.execute(sql `SELECT COUNT(*) as count FROM users`);
        // Get last activity
        const lastActivityResult = await db.execute(sql `
      SELECT created_at 
      FROM activities 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
        const tables = [
            {
                name: 'candidates',
                count: parseInt(candidatesResult.rows[0].count),
            },
            {
                name: 'projects',
                count: parseInt(projectsResult.rows[0].count),
            },
            {
                name: 'processing_jobs',
                count: parseInt(jobsResult.rows[0].count),
            },
            {
                name: 'activities',
                count: parseInt(activitiesResult.rows[0].count),
            },
            {
                name: 'users',
                count: parseInt(usersResult.rows[0].count),
            }
        ];
        const totalRecords = tables.reduce((sum, table) => sum + table.count, 0);
        return {
            status: 'healthy',
            tables,
            connectionTest: true,
            totalRecords,
            lastActivity: typeof lastActivityResult.rows[0]?.created_at === 'string'
                ? lastActivityResult.rows[0].created_at
                : undefined
        };
    }
    catch (error) {
        console.error('Database health check failed:', error);
        return {
            status: 'unhealthy',
            tables: [],
            connectionTest: false,
            totalRecords: 0
        };
    }
}
export async function optimizeDatabase() {
    const operations = [];
    try {
        // Analyze tables for query optimization
        await db.execute(sql `ANALYZE candidates`);
        operations.push('Analyzed candidates table');
        await db.execute(sql `ANALYZE processing_jobs`);
        operations.push('Analyzed processing_jobs table');
        await db.execute(sql `ANALYZE activities`);
        operations.push('Analyzed activities table');
        // Update table statistics
        operations.push('Updated table statistics');
        return { success: true, operations };
    }
    catch (error) {
        console.error('Database optimization failed:', error);
        return { success: false, operations };
    }
}
