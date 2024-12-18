-- AlterTable
ALTER TABLE "_duptimesTomeilisearchdatas" ADD CONSTRAINT "_duptimesTomeilisearchdatas_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_duptimesTomeilisearchdatas_AB_unique";

-- CreateTable
CREATE TABLE "siteConfig" (
    "id" SERIAL NOT NULL,
    "umami" TEXT,
    "umami_id" TEXT,

    CONSTRAINT "siteConfig_pkey" PRIMARY KEY ("id")
);
