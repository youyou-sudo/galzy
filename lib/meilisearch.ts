import { MeiliSearch } from "meilisearch";
import { env } from "next-runtime-env";

const MeiliSearchServer = new MeiliSearch({
  host: env("MEILISEARCH_HOST")!,
  apiKey: env("MEILISEARCH_MASTER"),
});

export default MeiliSearchServer;
