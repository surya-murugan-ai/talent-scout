-- Migration: Add company analysis and hireability fields to candidates table
-- Date: 2025-09-03

-- Add new columns for company comparison and hireability assessment
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS company_difference TEXT,
ADD COLUMN IF NOT EXISTS company_difference_score REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS hireability_score REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS hireability_factors JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS potential_to_join TEXT DEFAULT 'Unknown';

-- Create index on new fields for better query performance
CREATE INDEX IF NOT EXISTS idx_candidates_company_difference_score ON candidates(company_difference_score);
CREATE INDEX IF NOT EXISTS idx_candidates_hireability_score ON candidates(hireability_score);
CREATE INDEX IF NOT EXISTS idx_candidates_potential_to_join ON candidates(potential_to_join);

-- Update existing candidates with default values
UPDATE candidates 
SET 
  company_difference = 'No analysis available',
  company_difference_score = 0,
  hireability_score = 0,
  hireability_factors = '[]',
  potential_to_join = 'Unknown'
WHERE company_difference IS NULL;

-- Add comments to document the new fields
COMMENT ON COLUMN candidates.company_difference IS 'Difference between resume company and LinkedIn company';
COMMENT ON COLUMN candidates.company_difference_score IS 'Score for company difference (0-10)';
COMMENT ON COLUMN candidates.hireability_score IS 'Overall hireability score (0-10)';
COMMENT ON COLUMN candidates.hireability_factors IS 'Factors affecting hireability';
COMMENT ON COLUMN candidates.potential_to_join IS 'Potential to join company (High/Medium/Low/Unknown)';
