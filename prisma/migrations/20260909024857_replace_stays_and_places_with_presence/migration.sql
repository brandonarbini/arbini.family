/*
  Destructive, and deliberately so: there is no production data to preserve.

  `Stay` at a `Place` is replaced by `Presence` — the same date range, carrying a state
  (AROUND | AWAY) where the place used to be. There is no backfill because there is nothing
  to back fill; a family board that had been running would want one, and would want it in
  this file so a failure rolled back the DDL with it.

  Not a squashed baseline, though the history would read better as one. `pnpm build` runs
  `prisma migrate deploy`, and a rewritten history against an existing `_prisma_migrations`
  table fails that build — squashing would mean dropping the deployed database by hand first,
  which buys nothing.

  Warnings:

  - You are about to drop the column `place_id` on the `polls` table. All the data in the column will be lost.
  - You are about to drop the `places` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stays` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PresenceState" AS ENUM ('AROUND', 'AWAY');

-- DropForeignKey
ALTER TABLE "polls" DROP CONSTRAINT "polls_place_id_fkey";

-- DropForeignKey
ALTER TABLE "stays" DROP CONSTRAINT "stays_place_id_fkey";

-- DropForeignKey
ALTER TABLE "stays" DROP CONSTRAINT "stays_poll_id_fkey";

-- DropForeignKey
ALTER TABLE "stays" DROP CONSTRAINT "stays_profile_id_fkey";

-- AlterTable
ALTER TABLE "polls" DROP COLUMN "place_id";

-- DropTable
DROP TABLE "places";

-- DropTable
DROP TABLE "stays";

-- CreateTable
CREATE TABLE "presence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "state" "PresenceState" NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presence_profile_id_starts_on_idx" ON "presence"("profile_id", "starts_on");

-- CreateIndex
CREATE INDEX "presence_starts_on_idx" ON "presence"("starts_on");

-- AddForeignKey
ALTER TABLE "presence" ADD CONSTRAINT "presence_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
