-- Optimized candidates table for production with Eeezo integration
-- This migration consolidates resume_data into candidates table and adds com_id

-- First, add com_id to existing candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS com_id VARCHAR;

-- Add missing fields from resume_data that aren't in candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS projects JSONB DEFAULT '[]';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS achievements JSONB DEFAULT '[]';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS raw_text TEXT;

-- Add data source tracking for better data lineage
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'resume'; -- resume, linkedin, manual, eeezo
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending'; -- pending, in_progress, completed, failed
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS enrichment_date TIMESTAMP;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS enrichment_source TEXT; -- dev_fusion, harvestapi, manual

-- Add Eeezo-specific fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS eeezo_resume_url TEXT; -- URL provided by Eeezo
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS eeezo_upload_date TIMESTAMP;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS eeezo_status TEXT DEFAULT 'uploaded'; -- uploaded, processed, enriched, completed

-- Create optimized indexes for production performance
CREATE INDEX IF NOT EXISTS idx_candidates_com_id ON candidates(com_id);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON candidates(name);
CREATE INDEX IF NOT EXISTS idx_candidates_source ON candidates(source);
CREATE INDEX IF NOT EXISTS idx_candidates_data_source ON candidates(data_source);
CREATE INDEX IF NOT EXISTS idx_candidates_enrichment_status ON candidates(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at);
CREATE INDEX IF NOT EXISTS idx_candidates_updated_at ON candidates(updated_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_candidates_com_id_status ON candidates(com_id, enrichment_status);
CREATE INDEX IF NOT EXISTS idx_candidates_source_status ON candidates(source, enrichment_status);
CREATE INDEX IF NOT EXISTS idx_candidates_com_id_created ON candidates(com_id, created_at);

-- Migrate data from resume_data to candidates (if resume_data table exists)
DO $$
BEGIN
    -- Check if resume_data table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'resume_data') THEN
        -- Update candidates with data from resume_data
        UPDATE candidates 
        SET 
            filename = rd.filename,
            summary = rd.summary,
            projects = rd.projects,
            achievements = rd.achievements,
            interests = rd.interests,
            raw_text = rd.raw_text,
            data_source = 'resume',
            updated_at = NOW()
        FROM resume_data rd 
        WHERE candidates.id = rd.candidate_id;
        
        -- Log the migration
        INSERT INTO activities (type, message, details, created_at)
        VALUES ('migration', 'Migrated resume_data to candidates table', 'Consolidated data for better performance', NOW());
    END IF;
END $$;

-- Drop the resume_data table after migration (optional - uncomment if you want to remove it)
-- DROP TABLE IF EXISTS resume_data;

-- Add constraints for data integrity
ALTER TABLE candidates ADD CONSTRAINT chk_enrichment_status 
    CHECK (enrichment_status IN ('pending', 'in_progress', 'completed', 'failed'));

ALTER TABLE candidates ADD CONSTRAINT chk_eezo_status 
    CHECK (eezo_status IN ('uploaded', 'processed', 'enriched', 'completed'));

ALTER TABLE candidates ADD CONSTRAINT chk_data_source 
    CHECK (data_source IN ('resume', 'linkedin', 'manual', 'eezo', 'ats'));

-- Add comments for documentation
COMMENT ON COLUMN candidates.com_id IS 'Company ID from Eeezo system';
COMMENT ON COLUMN candidates.data_source IS 'Source of the data: resume, linkedin, manual, eeezo, ats';
COMMENT ON COLUMN candidates.enrichment_status IS 'Status of LinkedIn enrichment process';
COMMENT ON COLUMN candidates.eezo_resume_url IS 'Original resume URL provided by Eeezo';
COMMENT ON COLUMN candidates.eezo_status IS 'Processing status in Eeezo workflow';
