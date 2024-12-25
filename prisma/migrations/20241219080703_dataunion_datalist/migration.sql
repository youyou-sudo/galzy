-- CreateTable
CREATE TABLE "dataunion" (
    "id" SERIAL NOT NULL,
    "vnid" TEXT NOT NULL,
    "bangumi_id" TEXT,
    "ymgal_id" TEXT,
    "credible" INTEGER NOT NULL,

    CONSTRAINT "dataunion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vnid_index" ON "dataunion"("vnid");

-- CreateIndex
CREATE INDEX "bangumi_id_index" ON "dataunion"("bangumi_id");

-- CreateIndex
CREATE INDEX "ymgal_id_index" ON "dataunion"("ymgal_id");
