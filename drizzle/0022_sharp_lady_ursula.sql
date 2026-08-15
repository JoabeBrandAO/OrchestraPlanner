CREATE TYPE "public"."interaction_kind" AS ENUM('encontro', 'ligacao', 'mensagem', 'outro');--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"person_id" uuid NOT NULL,
	"happened_at" date NOT NULL,
	"kind" "interaction_kind" DEFAULT 'outro' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interactions_user_person_date_idx" ON "interactions" USING btree ("user_id","person_id","happened_at");