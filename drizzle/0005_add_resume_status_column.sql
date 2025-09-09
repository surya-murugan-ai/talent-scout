-- Add resume_status column to candidates table
ALTER TABLE candidates ADD COLUMN resume_status TEXT DEFAULT 'active';

-- Create index for performance when filtering by status
CREATE INDEX idx_candidates_resume_status ON candidates(resume_status);

-- Create composite index for common queries
CREATE INDEX idx_candidates_status_created ON candidates(resume_status, created_at);
