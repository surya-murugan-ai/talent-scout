CREATE TABLE "scoring_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"com_id" varchar NOT NULL,
	"open_to_work" integer DEFAULT 25,
	"skill_match" integer DEFAULT 25,
	"job_stability" integer DEFAULT 25,
	"platform_engagement" integer DEFAULT 25,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "scoring_configs_com_id_unique" UNIQUE("com_id")
);
--> statement-breakpoint
ALTER TABLE "candidates" RENAME COLUMN "updated_at" TO "com_id";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "scoring_weights" SET DEFAULT '{"openToWork":30,"skillMatch":25,"jobStability":15,"engagement":15,"companyDifference":15}'::jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "eezo_resume_url" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "eezo_upload_date" timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "eezo_status" text DEFAULT 'uploaded';--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "github_url" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "portfolio_url" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "filename" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "raw_text" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "experience" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "projects" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "achievements" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "interests" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "open_to_work_score" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "skill_match_score" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "job_stability_score" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "platform_engagement_score" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "resume_status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "company_difference" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "company_difference_score" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "hireability_score" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "hireability_factors" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "potential_to_join" text DEFAULT 'Unknown';--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "data_source" text DEFAULT 'resume';--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "enrichment_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "enrichment_date" timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "enrichment_source" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "extracted_data" jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "confidence" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "processing_time" integer DEFAULT 0;