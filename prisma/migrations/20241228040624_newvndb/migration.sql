/*
  Warnings:

  - You are about to drop the `dataunion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "tags_vndatas" DROP CONSTRAINT "tags_vndatas_cloud_id_fkey";

-- DropTable
DROP TABLE "dataunion";

-- AddForeignKey
ALTER TABLE "tags_vndatas" ADD CONSTRAINT "tags_vndatas_cloud_id_fkey" FOREIGN KEY ("cloud_id") REFERENCES "duptimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
