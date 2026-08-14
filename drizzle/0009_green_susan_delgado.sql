CREATE TABLE "life_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"life_area_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "life_assessments" ADD CONSTRAINT "life_assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_assessments" ADD CONSTRAINT "life_assessments_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "life_assessments_user_assessed_idx" ON "life_assessments" USING btree ("user_id","assessed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "life_assessments_round_area_uq" ON "life_assessments" USING btree ("user_id","assessed_at","life_area_id");