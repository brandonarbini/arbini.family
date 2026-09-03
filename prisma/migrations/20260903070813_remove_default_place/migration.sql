/*
  Warnings:

  - You are about to drop the column `default_place_id` on the `profiles` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_default_place_id_fkey";

-- DropIndex
DROP INDEX "profiles_default_place_id_idx";

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "default_place_id";
