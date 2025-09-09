/**
 * Script to check all unique com_id values in the database
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';

const neonSql = neon(process.env.DATABASE_URL);
const db = drizzle(neonSql);

async function checkComIds() {
  try {
    console.log('🔍 Checking all unique com_id values in the database...\n');
    
    // Get all unique com_id values
    const result = await db.execute(sql`
      SELECT DISTINCT com_id, COUNT(*) as count
      FROM candidates 
      WHERE com_id IS NOT NULL
      GROUP BY com_id
      ORDER BY count DESC
    `);
    
    console.log('📊 Found the following com_id values:');
    console.log('=====================================');
    
    if (result.length === 0) {
      console.log('❌ No candidates found with com_id values');
    } else {
      result.forEach((row, index) => {
        console.log(`${index + 1}. com_id: "${row.com_id}" (${row.count} candidates)`);
      });
    }
    
    console.log('\n🔍 Checking for candidates without com_id...');
    
    // Check for candidates without com_id
    const noComIdResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM candidates 
      WHERE com_id IS NULL OR com_id = ''
    `);
    
    const noComIdCount = noComIdResult[0]?.count || 0;
    if (noComIdCount > 0) {
      console.log(`⚠️  Found ${noComIdCount} candidates without com_id`);
    } else {
      console.log('✅ All candidates have com_id values');
    }
    
    console.log('\n📋 Summary:');
    console.log('===========');
    console.log(`Total unique com_id values: ${result.length}`);
    console.log(`Total candidates with com_id: ${result.reduce((sum, row) => sum + parseInt(row.count), 0)}`);
    console.log(`Candidates without com_id: ${noComIdCount}`);
    
  } catch (error) {
    console.error('❌ Error checking com_id values:', error);
  }
}

checkComIds();
