-- AlterTable
ALTER TABLE "events" ADD COLUMN     "poll_id" UUID;

-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "place_id" UUID;

-- AlterTable
ALTER TABLE "stays" ADD COLUMN     "poll_id" UUID;

-- CreateIndex
CREATE INDEX "events_poll_id_idx" ON "events"("poll_id");

-- CreateIndex
CREATE INDEX "stays_poll_id_idx" ON "stays"("poll_id");

-- AddForeignKey
ALTER TABLE "stays" ADD CONSTRAINT "stays_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
