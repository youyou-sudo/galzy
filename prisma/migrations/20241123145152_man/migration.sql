-- CreateTable
CREATE TABLE "duptimes" (
    "id" SERIAL NOT NULL,
    "jsonorl" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" BOOLEAN NOT NULL DEFAULT false,
    "Statusdescription" TEXT,
    "timeVersion" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "updatetime" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duptimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meilisearchdatas" (
    "id" SERIAL NOT NULL,
    "host" TEXT,
    "indexName" TEXT,
    "masterKey" TEXT,
    "adminKey" TEXT,
    "searchKey" TEXT,
    "type" TEXT NOT NULL,
    "primaryKey" TEXT,
    "Status" TEXT,
    "Statusdescription" TEXT,

    CONSTRAINT "meilisearchdatas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filesiddatas" (
    "id" SERIAL NOT NULL,
    "cloudName" TEXT,
    "cloud_id" INTEGER NOT NULL,
    "vid" TEXT,
    "filetype" BOOLEAN NOT NULL,
    "is_dir" BOOLEAN NOT NULL,
    "path" TEXT NOT NULL,
    "size" TEXT NOT NULL,

    CONSTRAINT "filesiddatas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vndbdatas" (
    "cloud_id" INTEGER NOT NULL,
    "vnid" TEXT NOT NULL,
    "alias" TEXT[],
    "image" TEXT NOT NULL,
    "olang" TEXT NOT NULL,
    "releases" JSONB NOT NULL,
    "titles" JSONB NOT NULL,

    CONSTRAINT "vndbdatas_pkey" PRIMARY KEY ("vnid")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "gid" TEXT NOT NULL,
    "cloud_id" INTEGER NOT NULL,
    "cat" TEXT NOT NULL,
    "defaultspoil" TEXT NOT NULL,
    "searchable" TEXT NOT NULL,
    "applicable" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags_vndatas" (
    "unid" TEXT NOT NULL,
    "tag" TEXT,
    "uid" TEXT NOT NULL,
    "vid" TEXT,
    "average_rating" DOUBLE PRECISION,
    "average_spoiler" DOUBLE PRECISION,
    "lie" TEXT,
    "cloud_id" INTEGER NOT NULL,

    CONSTRAINT "tags_vndatas_pkey" PRIMARY KEY ("unid")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "twoFactor" TEXT,
    "identity" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_duptimesTomeilisearchdatas" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "duptimes_name_index" ON "duptimes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "meilisearchdatas_indexName_key" ON "meilisearchdatas"("indexName");

-- CreateIndex
CREATE INDEX "meilisearchdatas_host_index" ON "meilisearchdatas"("host");

-- CreateIndex
CREATE UNIQUE INDEX "filesiddatas_path_vid_key" ON "filesiddatas"("path", "vid");

-- CreateIndex
CREATE UNIQUE INDEX "tags_gid_key" ON "tags"("gid");

-- CreateIndex
CREATE INDEX "tags_name_index" ON "tags"("name");

-- CreateIndex
CREATE INDEX "tags_alias_index" ON "tags"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "tags_vndatas_unid_key" ON "tags_vndatas"("unid");

-- CreateIndex
CREATE UNIQUE INDEX "users_name_key" ON "users"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "_duptimesTomeilisearchdatas_AB_unique" ON "_duptimesTomeilisearchdatas"("A", "B");

-- CreateIndex
CREATE INDEX "_duptimesTomeilisearchdatas_B_index" ON "_duptimesTomeilisearchdatas"("B");

-- AddForeignKey
ALTER TABLE "filesiddatas" ADD CONSTRAINT "filesiddatas_cloud_id_fkey" FOREIGN KEY ("cloud_id") REFERENCES "duptimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filesiddatas" ADD CONSTRAINT "filesiddatas_vid_fkey" FOREIGN KEY ("vid") REFERENCES "vndbdatas"("vnid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vndbdatas" ADD CONSTRAINT "vndbdatas_cloud_id_fkey" FOREIGN KEY ("cloud_id") REFERENCES "duptimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_cloud_id_fkey" FOREIGN KEY ("cloud_id") REFERENCES "duptimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags_vndatas" ADD CONSTRAINT "tags_vndatas_cloud_id_fkey" FOREIGN KEY ("cloud_id") REFERENCES "duptimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags_vndatas" ADD CONSTRAINT "tags_vndatas_vid_fkey" FOREIGN KEY ("vid") REFERENCES "vndbdatas"("vnid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags_vndatas" ADD CONSTRAINT "tags_vndatas_tag_fkey" FOREIGN KEY ("tag") REFERENCES "tags"("gid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_duptimesTomeilisearchdatas" ADD CONSTRAINT "_duptimesTomeilisearchdatas_A_fkey" FOREIGN KEY ("A") REFERENCES "duptimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_duptimesTomeilisearchdatas" ADD CONSTRAINT "_duptimesTomeilisearchdatas_B_fkey" FOREIGN KEY ("B") REFERENCES "meilisearchdatas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
