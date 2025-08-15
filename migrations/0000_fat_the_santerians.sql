CREATE TABLE "activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"title" text,
	"company" text,
	"linkedin_url" text,
	"skills" jsonb DEFAULT '[]'::jsonb,
	"score" real DEFAULT 0,
	"priority" text DEFAULT 'Low',
	"open_to_work" boolean DEFAULT false,
	"last_active" text,
	"notes" text,
	"original_data" jsonb,
	"enriched_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar,
	"file_name" text NOT NULL,
	"file_size" integer,
	"status" text DEFAULT 'pending',
	"progress" integer DEFAULT 0,
	"total_records" integer DEFAULT 0,
	"processed_records" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active',
	"total_candidates" integer DEFAULT 0,
	"processed_candidates" integer DEFAULT 0,
	"scoring_weights" jsonb DEFAULT '{"openToWork":40,"skillMatch":30,"jobStability":15,"engagement":15}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;