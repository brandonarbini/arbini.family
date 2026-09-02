-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "default_place_id" UUID;

-- CreateIndex
CREATE INDEX "profiles_default_place_id_idx" ON "profiles"("default_place_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_default_place_id_fkey" FOREIGN KEY ("default_place_id") REFERENCES "places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
