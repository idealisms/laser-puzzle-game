/*
  Warnings:

  - You are about to drop the `LevelProgress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserStats` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey (skip if not exists)
ALTER TABLE IF EXISTS "LevelProgress" DROP CONSTRAINT IF EXISTS "LevelProgress_levelId_fkey";

-- DropForeignKey (skip if not exists)
ALTER TABLE IF EXISTS "LevelProgress" DROP CONSTRAINT IF EXISTS "LevelProgress_userId_fkey";

-- DropForeignKey (skip if not exists)
ALTER TABLE IF EXISTS "UserStats" DROP CONSTRAINT IF EXISTS "UserStats_userId_fkey";

-- AlterTable (skip if column already exists)
ALTER TABLE "Level" ADD COLUMN IF NOT EXISTS "optimalSolution" TEXT;

-- DropTable
DROP TABLE IF EXISTS "LevelProgress";

-- DropTable
DROP TABLE IF EXISTS "User";

-- DropTable
DROP TABLE IF EXISTS "UserStats";

-- CreateTable (skip if already exists)
CREATE TABLE IF NOT EXISTS "ScoreSubmission" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (skip if already exists)
CREATE INDEX IF NOT EXISTS "ScoreSubmission_levelId_score_idx" ON "ScoreSubmission"("levelId", "score");

-- CreateIndex (skip if already exists)
CREATE UNIQUE INDEX IF NOT EXISTS "ScoreSubmission_levelId_playerId_key" ON "ScoreSubmission"("levelId", "playerId");

-- AddForeignKey (skip if already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScoreSubmission_levelId_fkey') THEN
    ALTER TABLE "ScoreSubmission" ADD CONSTRAINT "ScoreSubmission_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
