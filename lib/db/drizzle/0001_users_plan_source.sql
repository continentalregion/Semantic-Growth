ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_source" text NOT NULL DEFAULT 'stripe';
