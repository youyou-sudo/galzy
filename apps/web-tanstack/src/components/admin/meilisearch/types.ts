/** 索引类型 */
export type IndexType = 'game' | 'tag';

// ─── Meilisearch Stats ────────────────────────────────────────

export interface MeiliIndexInfo {
  numberOfDocuments: number;
  isIndexing: boolean;
  fieldDistribution: Record<string, number>;
}

export interface MeiliStats {
  databaseSize: number;
  lastUpdate: string | null;
  indexes: Record<string, MeiliIndexInfo>;
}

// ─── Embedders ────────────────────────────────────────────────

export interface EmbedderConfig {
  source: string;
  url: string;
  apiKey: string;
  model: string;
  documentTemplateMaxBytes: number;
  documentTemplate: string;
}

export interface EmbeddersResponse {
  default?: EmbedderConfig;
  [embedderName: string]: EmbedderConfig | undefined;
}

// ─── Index Rebuild Progress ──────────────────────────────────

export interface MeiliLogEntry {
  time: string;
  level: 'info' | 'success' | 'error';
  message: string;
}

export interface MeiliProgress {
  status: 'idle' | 'running' | 'completed' | 'failed';
  type: 'game' | 'tag' | null;
  startedAt: string | null;
  completedAt: string | null;
  totalPages: number;
  processedPages: number;
  errors: number;
  logs: MeiliLogEntry[];
  lastUpdated: string;
}
