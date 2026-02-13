/*
  Warnings:

  - You are about to drop the `LevelProgress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserStats` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LevelProgress" DROP CONSTRAINT "LevelProgress_levelId_fkey";

-- DropForeignKey
ALTER TABLE "LevelProgress" DROP CONSTRAINT "LevelProgress_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserStats" DROP CONSTRAINT "UserStats_userId_fkey";

-- AlterTable
ALTER TABLE "Level" ADD COLUMN     "optimalSolution" TEXT;

-- DropTable
DROP TABLE "LevelProgress";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "UserStats";

-- CreateTable
CREATE TABLE "ScoreSubmission" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreSubmission_levelId_score_idx" ON "ScoreSubmission"("levelId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreSubmission_levelId_playerId_key" ON "ScoreSubmission"("levelId", "playerId");

-- AddForeignKey
ALTER TABLE "ScoreSubmission" ADD CONSTRAINT "ScoreSubmission_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;
