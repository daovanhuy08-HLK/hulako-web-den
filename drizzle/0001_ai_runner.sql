ALTER TABLE "ai_jobs" ADD COLUMN "ai_request" jsonb;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD COLUMN "ai_response" jsonb;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD COLUMN "runner" text;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD COLUMN "claimed_at" timestamp with time zone;