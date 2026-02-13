-- AlterTable: make passwordHash nullable for Twitch-only users
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable: add twitchId and twitchDisplayName to User
ALTER TABLE "User" ADD COLUMN "twitchId" TEXT;
ALTER TABLE "User" ADD COLUMN "twitchDisplayName" TEXT;

-- CreateIndex: unique twitchId
CREATE UNIQUE INDEX "User_twitchId_key" ON "User"("twitchId");
