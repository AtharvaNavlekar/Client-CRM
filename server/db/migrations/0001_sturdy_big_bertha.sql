CREATE TABLE "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"model" text NOT NULL,
	"action" text NOT NULL,
	"cost" real DEFAULT 0 NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	"occurred_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "lead_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "lead_phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "rep_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "assigned_rep_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "notes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "delivery_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "compliance_flags" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_contact_date" timestamp;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "rep_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "status" text;--> statement-breakpoint
CREATE INDEX "idx_ai_usage_tenant_time" ON "ai_usage" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_calls_tenant_lead" ON "calls" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "idx_calls_tenant_rep" ON "calls" USING btree ("tenant_id","rep_id");--> statement-breakpoint
CREATE INDEX "idx_calls_tenant_time" ON "calls" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_jobs_tenant_status" ON "jobs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_jobs_tenant_type" ON "jobs" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "idx_jobs_queue_job_id" ON "jobs" USING btree ("queue_job_id");--> statement-breakpoint
CREATE INDEX "idx_leads_tenant_stage" ON "leads" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "idx_leads_tenant_rep" ON "leads" USING btree ("tenant_id","assigned_rep_id");--> statement-breakpoint
CREATE INDEX "idx_leads_tenant_created" ON "leads" USING btree ("tenant_id","created_date");--> statement-breakpoint
CREATE INDEX "idx_leads_tenant_team" ON "leads" USING btree ("tenant_id","team_id");--> statement-breakpoint
CREATE INDEX "idx_messages_tenant_lead" ON "messages" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "idx_messages_tenant_time" ON "messages" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_tickets_tenant_status" ON "tickets" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_tickets_tenant_rep" ON "tickets" USING btree ("tenant_id","assigned_rep_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_tenant_lead" ON "tickets" USING btree ("tenant_id","lead_id");