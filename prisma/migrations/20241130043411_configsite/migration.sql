/*
  Warnings:

  - You are about to drop the column `umami` on the `siteConfig` table. All the data in the column will be lost.
  - You are about to drop the column `umami_id` on the `siteConfig` table. All the data in the column will be lost.
  - Added the required column `type` to the `siteConfig` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "siteConfig" DROP COLUMN "umami",
DROP COLUMN "umami_id",
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "value" JSONB;
