import { pgTable, text, varchar, boolean, bigint, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

// galrc_search_nodes — 从Alist API同步的节点
export const searchNodes = pgTable('galrc_search_nodes', {
  parent: text('parent'),
  name: text('name'),
  isDir: boolean('is_dir'),
  size: bigint('size', { mode: 'number' }),
}, (table) => ({
  parentIdx: index('idx_galrc_search_nodes_parent').on(table.parent),
  nameIdx: index('idx_galrc_search_nodes_name').on(table.name),
}))

// galrc_setting_items — Alist设置项
export const settingItems = pgTable('galrc_setting_items', {
  key: text('key'),
  value: text('value'),
  help: text('help'),
  type: text('type'),
  options: text('options'),
  group: bigint('group', { mode: 'number' }),
  flag: bigint('flag', { mode: 'number' }),
  index: bigint('index', { mode: 'number' }),
}, (table) => ({
  keyIdx: index('idx_galrc_setting_items_key').on(table.key),
  typeIdx: index('idx_galrc_setting_items_type').on(table.type),
  groupIdx: index('idx_galrc_setting_items_group').on(table.group),
}))

// galrc_storages — Alist存储配置
export const storages = pgTable('galrc_storages', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  mountPath: text('mount_panth'),
  order: bigint('order', { mode: 'number' }),
  driver: text('driver'),
  cacheExpiration: bigint('cache_expiration', { mode: 'number' }),
  status: text('status'),
  addition: text('addition'),
  remark: text('remark'),
  modified: timestamp('modified').defaultNow(),
  disabled: boolean('disabled'),
  disableIndex: boolean('disable_index'),
  enableSign: boolean('enable_sign'),
  orderBy: text('order_by'),
  orderDirection: text('order_direction'),
  extractFolder: text('extract_folder'),
  webProxy: boolean('web_proxy'),
  webdavPolicy: text('webdav_policy'),
  proxyRange: boolean('proxy_range'),
  downProxyUrl: text('down_proxy_url'),
}, (table) => ({
  statusIdx: index('idx_galrc_storages_status').on(table.status),
  disabledIdx: index('idx_galrc_storages_disabled').on(table.disabled),
  driverIdx: index('idx_galrc_storages_driver').on(table.driver),
}))
