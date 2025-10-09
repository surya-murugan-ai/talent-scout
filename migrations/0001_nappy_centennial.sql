ALTER TABLE "candidates" ADD COLUMN "current_employer" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "linkedin_last_active" timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "linkedin_notes" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "middle_name" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "current_title" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "current_company" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "years_of_experience" real;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "education" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "work_history" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "certifications" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "languages" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "salary" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "availability" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "remote_preference" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "visa_status" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "linkedin_headline" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "linkedin_summary" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "linkedin_connections" integer;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "alternate_email" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "github" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "portfolio" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "source_file" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "processing_date" timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "data_quality" real;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "ats_id" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "selection_status" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "selection_date" timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "joining_outcome" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "ats_notes" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "source" text DEFAULT 'upload';