CREATE TABLE "toss_registration_identities" (
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	CONSTRAINT "toss_registration_identities_user_id_product_id_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "toss_registration_identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "toss_registration_identities" ADD CONSTRAINT "toss_registration_identities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;