CREATE TYPE "public"."account_kind" AS ENUM('corrente', 'poupanca', 'carteira', 'cartao', 'investimento');--> statement-breakpoint
CREATE TYPE "public"."transaction_direction" AS ENUM('entrada', 'saida');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "account_kind" DEFAULT 'corrente' NOT NULL,
	"initial_balance_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"direction" "transaction_direction" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"life_area_id" uuid,
	"happened_at" date NOT NULL,
	"direction" "transaction_direction" NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_transaction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."transaction_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_lower_name_uq" ON "accounts" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_categories_user_name_direction_uq" ON "transaction_categories" USING btree ("user_id",lower("name"),"direction");--> statement-breakpoint
CREATE INDEX "transactions_user_account_date_idx" ON "transactions" USING btree ("user_id","account_id","happened_at");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","happened_at");