CREATE TABLE "index_status" (
	"path" text PRIMARY KEY NOT NULL,
	"article_id" uuid,
	"submit_count" integer DEFAULT 0 NOT NULL,
	"last_submitted_at" timestamp with time zone,
	"index_now_code" integer,
	"submit_note" text DEFAULT '' NOT NULL,
	"inspected_at" timestamp with time zone,
	"verdict" text,
	"coverage" text DEFAULT '' NOT NULL,
	"last_crawl_at" timestamp with time zone,
	"indexed_at" timestamp with time zone,
	"removed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "index_status_article_idx" ON "index_status" USING btree ("article_id");