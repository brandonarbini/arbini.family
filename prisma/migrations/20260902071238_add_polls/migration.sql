-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('OPEN', 'SETTLED');

-- CreateEnum
CREATE TYPE "ReplyKind" AS ENUM ('YES', 'MAYBE', 'NO');

-- CreateTable
CREATE TABLE "polls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "status" "PollStatus" NOT NULL DEFAULT 'OPEN',
    "settled_option_id" UUID,
    "settled_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "poll_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_replies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "option_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "kind" "ReplyKind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poll_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "polls_settled_option_id_key" ON "polls"("settled_option_id");

-- CreateIndex
CREATE INDEX "polls_status_created_at_idx" ON "polls"("status", "created_at");

-- CreateIndex
CREATE INDEX "poll_options_poll_id_sort_order_idx" ON "poll_options"("poll_id", "sort_order");

-- CreateIndex
CREATE INDEX "poll_replies_profile_id_idx" ON "poll_replies"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_replies_option_id_profile_id_key" ON "poll_replies"("option_id", "profile_id");

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_settled_option_id_fkey" FOREIGN KEY ("settled_option_id") REFERENCES "poll_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_replies" ADD CONSTRAINT "poll_replies_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_replies" ADD CONSTRAINT "poll_replies_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
