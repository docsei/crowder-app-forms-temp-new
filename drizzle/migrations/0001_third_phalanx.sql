CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"secret" text NOT NULL,
	"secret_previous" text,
	"secret_previous_expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Migra la API key del singleton partner_config a la nueva tabla uno-a-muchos
-- como entrada "Default", preservando la key anterior con 24 h de gracia.
INSERT INTO "api_keys" ("name", "secret", "secret_previous", "secret_previous_expires_at")
SELECT 'Default', "crowder_api_key", "crowder_api_key_previous",
	CASE WHEN "crowder_api_key_previous" IS NOT NULL THEN now() + interval '24 hours' ELSE NULL END
FROM "partner_config"
WHERE "id" = 1 AND "crowder_api_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_config" DROP COLUMN "crowder_api_key";--> statement-breakpoint
ALTER TABLE "partner_config" DROP COLUMN "crowder_api_key_previous";--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "deleted_at" timestamp with time zone;