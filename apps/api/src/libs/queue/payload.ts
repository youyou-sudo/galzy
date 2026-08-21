/**
 * 任务队列的入队 payload（queue.add 的 data 参数）。
 *
 * 每个任务类型带一个 `type` 判别字段，Worker 侧据此分派到现有业务函数
 * （CronService / VndbSync）。payload 会被序列化进 Redis，故只放可 JSON 化的
 * 轻量参数，不放函数/连接等。
 */
export type TaskPayload =
  | { type: 'vndb-full' }
  | { type: 'vndb-delta' }
  | { type: 'vndb-producers' }
  | { type: 'kungal-full' }
  | { type: 'kungal-delta' }
  | { type: 'meili-game' }
  | { type: 'meili-tag' }
  | { type: 'meili-producer' }
  | { type: 'cloudreve-sync' }
  | { type: 'queue-log-prune' }

export type TaskType = TaskPayload['type']
