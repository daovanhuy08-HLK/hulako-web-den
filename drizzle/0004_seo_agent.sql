CREATE TABLE "agent_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"day" date NOT NULL,
	"title" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"lastmod" text,
	"hash" text,
	"word_count" integer,
	"headings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" text DEFAULT 'seen' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_at" timestamp with time zone,
	CONSTRAINT "competitor_pages_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"discovered_by" text DEFAULT 'manual' NOT NULL,
	"seen_in_serp" integer DEFAULT 0 NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"last_crawled_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitors_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "serp_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword" text NOT NULL,
	"normalized" text NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"our_position" integer,
	"decode" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text DEFAULT 'claude_websearch' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "keywords" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitor_pages" ADD CONSTRAINT "competitor_pages_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_insights_kind_day_idx" ON "agent_insights" USING btree ("kind","day");--> statement-breakpoint
CREATE INDEX "competitor_pages_comp_idx" ON "competitor_pages" USING btree ("competitor_id","first_seen_at");--> statement-breakpoint
CREATE INDEX "serp_norm_idx" ON "serp_snapshots" USING btree ("normalized","created_at");