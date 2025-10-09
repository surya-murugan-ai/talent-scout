#!/usr/bin/env node

// Simple script to add missing database fields
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function addMissingFields() {
  console.log('🔧 Adding missing database fields...');
  console.log('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  
  try {
    // Add missing fields one by one
    const fields = [
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS first_name TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_name TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS middle_name TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_title TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_company TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS years_of_experience REAL',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education JSONB DEFAULT \'[]\'',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_history JSONB DEFAULT \'[]\'',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT \'[]\'',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT \'[]\'',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS availability TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS remote_preference TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS visa_status TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_headline TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_summary TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_connections INTEGER',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS alternate_email TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS website TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS github TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS portfolio TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source_file TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS processing_date TIMESTAMP',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS data_quality REAL',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ats_id TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS selection_status TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS selection_date TIMESTAMP',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS joining_outcome TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ats_notes TEXT',
      'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source TEXT DEFAULT \'upload\''
    ];

    for (const field of fields) {
      try {
        await sql(field);
        console.log(`✅ Added field: ${field.split(' ')[5]}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⏭️  Field already exists: ${field.split(' ')[5]}`);
        } else {
          console.log(`❌ Error adding field: ${error.message}`);
        }
      }
    }

    console.log('🎉 Database fields updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating database:', error);
  }
}

addMissingFields();
