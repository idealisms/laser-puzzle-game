/*
  Warnings:

  - Added the required column `optimalScore` to the `Level` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Level" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "gridWidth" INTEGER NOT NULL DEFAULT 10,
    "gridHeight" INTEGER NOT NULL DEFAULT 10,
    "laserConfig" TEXT NOT NULL,
    "obstacles" TEXT NOT NULL,
    "mirrorsAvailable" INTEGER NOT NULL DEFAULT 5,
    "starThresholds" TEXT NOT NULL,
    "optimalScore" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Level" ("createdAt", "date", "gridHeight", "gridWidth", "id", "laserConfig", "mirrorsAvailable", "obstacles", "starThresholds") SELECT "createdAt", "date", "gridHeight", "gridWidth", "id", "laserConfig", "mirrorsAvailable", "obstacles", "starThresholds" FROM "Level";
DROP TABLE "Level";
ALTER TABLE "new_Level" RENAME TO "Level";
CREATE UNIQUE INDEX "Level_date_key" ON "Level"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
