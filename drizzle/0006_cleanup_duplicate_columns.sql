-- Clean up duplicate columns and remove resume_data table

-- Drop the resume_data table since it's redundant
DROP TABLE IF EXISTS resume_data;

-- Remove any duplicate columns that might exist
-- (These should already be consolidated in the candidates table)

-- Ensure resume_status column exists and has proper default
ALTER TABLE candidates ALTER COLUMN resume_status SET DEFAULT 'active';

-- Update any NULL resume_status values to 'active'
UPDATE candidates SET resume_status = 'active' WHERE resume_status IS NULL OR resume_status = '';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_candidates_resume_status ON candidates(resume_status);
CREATE INDEX IF NOT EXISTS idx_candidates_status_created ON candidates(resume_status, created_at);
