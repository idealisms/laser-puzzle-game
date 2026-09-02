-- AlterTable
ALTER TABLE "ScoreSubmission" ADD COLUMN IF NOT EXISTS "timeSpentSeconds" INTEGER;
ALTER TABLE "ScoreSubmission" ADD COLUMN IF NOT EXISTS "mirrorsErased" INTEGER;
ALTER TABLE "ScoreSubmission" ADD COLUMN IF NOT EXISTS "resetCount" INTEGER;
