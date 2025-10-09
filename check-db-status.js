/**
 * Check database status for resume_status column
 */

import { db } from './server/db.ts';
import { candidates } from './shared/schema.ts';
import { sql } from 'drizzle-orm';

async function checkDatabaseStatus() {
  try {
    console.log('🔍 Checking database status...\n');
    
    // Check if resume_status column exists and has data
    const result = await db.execute(sql`
      SELECT 
        id, 
        name, 
        resume_status,
        CASE 
          WHEN resume_status IS NULL THEN 'NULL'
          WHEN resume_status = '' THEN 'EMPTY'
          ELSE resume_status
        END as status_check
      FROM candidates 
      LIMIT 5
    `);
    
    console.log('📊 Database Results:');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}`);
      console.log(`   Name: ${row.name}`);
      console.log(`   Resume Status: ${row.resume_status}`);
      console.log(`   Status Check: ${row.status_check}`);
      console.log('');
    });
    
    // Check column info
    const columnInfo = await db.execute(sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'candidates' 
      AND column_name = 'resume_status'
    `);
    
    console.log('📋 Column Information:');
    if (columnInfo.rows.length > 0) {
      const col = columnInfo.rows[0];
      console.log(`Column: ${col.column_name}`);
      console.log(`Type: ${col.data_type}`);
      console.log(`Default: ${col.column_default}`);
      console.log(`Nullable: ${col.is_nullable}`);
    } else {
      console.log('❌ resume_status column not found!');
    }
    
    // Update existing records to have 'active' status
    console.log('\n🔧 Updating existing records to have "active" status...');
    const updateResult = await db.execute(sql`
      UPDATE candidates 
      SET resume_status = 'active' 
      WHERE resume_status IS NULL OR resume_status = ''
    `);
    
    console.log(`Updated ${updateResult.rowCount} records`);
    
    // Check again
    const afterUpdate = await db.execute(sql`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN resume_status = 'active' THEN 1 END) as active_count,
             COUNT(CASE WHEN resume_status = 'inactive' THEN 1 END) as inactive_count
      FROM candidates
    `);
    
    console.log('\n📈 After Update:');
    const stats = afterUpdate.rows[0];
    console.log(`Total: ${stats.total}`);
    console.log(`Active: ${stats.active_count}`);
    console.log(`Inactive: ${stats.inactive_count}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkDatabaseStatus();
