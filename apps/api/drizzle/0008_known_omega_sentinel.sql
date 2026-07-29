CREATE INDEX "idx_galrc_game_download_stats_created_game" ON "galrc_gameDownloadStats" USING btree ("created_at","game_id");
