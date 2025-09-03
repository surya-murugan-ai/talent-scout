-- Add new columns to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS extracted_data JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS confidence REAL DEFAULT 0;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS processing_time INTEGER DEFAULT 0;

-- Create resume_data table
CREATE TABLE IF NOT EXISTS resume_data (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id VARCHAR REFERENCES candidates(id),
  filename TEXT NOT NULL,
  
  -- Basic Info
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  location TEXT,
  title TEXT,
  summary TEXT,
  
  -- Structured Data
  experience JSONB DEFAULT '[]',
  education JSONB DEFAULT '[]',
  projects JSONB DEFAULT '[]',
  achievements JSONB DEFAULT '[]',
  certifications JSONB DEFAULT '[]',
  skills JSONB DEFAULT '[]',
  interests JSONB DEFAULT '[]',
  languages JSONB DEFAULT '[]',
  
  -- Metadata
  raw_text TEXT,
  confidence REAL DEFAULT 0,
  processing_time INTEGER DEFAULT 0,
  source TEXT DEFAULT 'resume',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_resume_data_candidate_id ON resume_data(candidate_id);
CREATE INDEX IF NOT EXISTS idx_resume_data_name ON resume_data(name);
CREATE INDEX IF NOT EXISTS idx_resume_data_email ON resume_data(email);
CREATE INDEX IF NOT EXISTS idx_resume_data_created_at ON resume_data(created_at);
