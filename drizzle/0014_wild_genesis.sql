CREATE TABLE "event_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"occurrence_starts_at" timestamp with time zone NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"title" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_exceptions" ADD CONSTRAINT "event_exceptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_exceptions" ADD CONSTRAINT "event_exceptions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_exceptions_event_occurrence_key" ON "event_exceptions" USING btree ("event_id","occurrence_starts_at");--> statement-breakpoint
CREATE INDEX "event_exceptions_user_event_idx" ON "event_exceptions" USING btree ("user_id","event_id");