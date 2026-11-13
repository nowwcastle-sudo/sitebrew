CREATE TABLE "retention_offer_uses" (
	"provider" text NOT NULL,
	"provider_sub_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"reserved_at" timestamp with time zone NOT NULL,
	"applied_at" timestamp with time zone,
	CONSTRAINT "retention_offer_uses_provider_provider_sub_id_offer_id_pk" PRIMARY KEY("provider","provider_sub_id","offer_id")
);
--> statement-breakpoint
ALTER TABLE "retention_offer_uses" ENABLE ROW LEVEL SECURITY;