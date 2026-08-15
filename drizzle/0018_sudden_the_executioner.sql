CREATE TYPE "public"."contact_kind" AS ENUM('telefone', 'email', 'social', 'endereco');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('feminino', 'masculino', 'outro', 'nao_informado');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('solteiro', 'casado', 'uniao_estavel', 'divorciado', 'viuvo', 'nao_informado');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('familia', 'conjuge', 'amigo', 'mentor', 'colega', 'irmao_fe', 'outro');--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"life_area_id" uuid,
	"name" text NOT NULL,
	"nickname" text,
	"birth_day" integer,
	"birth_month" integer,
	"birth_year" integer,
	"gender" "gender" DEFAULT 'nao_informado' NOT NULL,
	"marital_status" "marital_status" DEFAULT 'nao_informado' NOT NULL,
	"married_at" date,
	"relation_type" "relation_type" DEFAULT 'outro' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "contact_kind" NOT NULL,
	"label" text,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_contacts" ADD CONSTRAINT "people_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_contacts" ADD CONSTRAINT "people_contacts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "people_user_name_idx" ON "people" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "people_user_birthday_idx" ON "people" USING btree ("user_id","birth_month","birth_day");--> statement-breakpoint
CREATE INDEX "people_contacts_person_idx" ON "people_contacts" USING btree ("user_id","person_id");