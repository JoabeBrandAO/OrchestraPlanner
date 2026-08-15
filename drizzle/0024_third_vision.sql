ALTER TABLE "reminder_sends" ALTER COLUMN "event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder_sends" ADD COLUMN "person_id" uuid;--> statement-breakpoint
ALTER TABLE "reminder_sends" ADD CONSTRAINT "reminder_sends_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_sends_person_occurrence_key" ON "reminder_sends" USING btree ("person_id","occurrence_starts_at");