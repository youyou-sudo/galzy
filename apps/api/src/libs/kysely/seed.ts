import { db, sql } from './webData'
import { vndbDb } from './vndb'

export const dbSeed = async () => {
  await db.schema
    .createTable('galrc_user')
    .ifNotExists()
    .addColumn('id', 'text', (cb) => cb.primaryKey())
    .addColumn('name', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('email', 'varchar(255)', (cb) => cb.notNull().unique())
    .addColumn('emailVerified', 'boolean', (cb) =>
      cb.notNull().defaultTo(false),
    )
    .addColumn('image', 'varchar(255)')
    .addColumn('role', 'varchar(10)', (cb) =>
      cb.notNull().defaultTo('user').check(sql`role IN ('user', 'admin')`),
    )
    .addColumn('banned', 'boolean', (cb) => cb.notNull().defaultTo(false))
    .addColumn('ban_reason', 'text')
    .addColumn('ban_expires', 'timestamp')
    .addColumn('createdAt', sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`),
    )
    .addColumn('updatedAt', sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`),
    )
    .execute()

  await db.schema
    .createTable('galrc_session')
    .ifNotExists()
    .addColumn('id', 'text', (cb) => cb.primaryKey())
    .addColumn('userId', 'varchar(255)', (cb) =>
      cb.notNull().references('galrc_user.id'),
    )
    .addColumn('token', 'varchar(255)', (cb) => cb.notNull().unique())
    .addColumn('expiresAt', sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`),
    )
    .addColumn('ipAddress', 'varchar(255)')
    .addColumn('userAgent', 'varchar(255)')
    .addColumn('createdAt', sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`),
    )
    .addColumn('updatedAt', sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`),
    )
    .execute()

  await db.schema
    .createTable('galrc_account')
    .ifNotExists()
    .addColumn('id', 'text', (cb) => cb.primaryKey())
    .addColumn('userId', 'varchar(255)', (cb) =>
      cb.notNull().references('galrc_user.id').onDelete('cascade'),
    )
    .addColumn('accountId', 'varchar(255)')
    .addColumn('providerId', 'varchar(255)')
    .addColumn('accessToken', 'text')
    .addColumn('refreshToken', 'text')
    .addColumn('accessTokenExpiresAt', 'timestamp')
    .addColumn('refreshTokenExpiresAt', 'timestamp')
    .addColumn('scope', 'text')
    .addColumn('idToken', 'text')
    .addColumn('password', 'text')
    .addColumn('createdAt', 'timestamp', (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull(),
    )
    .addColumn('updatedAt', 'timestamp', (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull(),
    )
    .addUniqueConstraint('accounts_userId_providerId_unique', [
      'userId',
      'providerId',
    ])
    .execute()

  await db.schema
    .createTable('galrc_verification')
    .ifNotExists()
    .addColumn('id', 'text', (cb) => cb.primaryKey())
    .addColumn('identifier', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('value', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('expiresAt', 'timestamp', (cb) => cb.notNull())
    .addColumn('createdAt', 'timestamp', (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull(),
    )
    .addColumn('updatedAt', 'timestamp', (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull(),
    )
    .execute()

  await db.schema
    .createTable('galrc_other')
    .ifNotExists()
    .addColumn('id', 'serial', (cb) => cb.primaryKey())
    .addColumn('title', 'jsonb')
    .addColumn('alias', 'text')
    .addColumn('introduction', 'text')
    .addColumn('description', 'text')
    .addColumn('status', 'text')
    .execute()

  await db.schema
    .createTable('galrc_media')
    .ifNotExists()
    .addColumn('hash', 'text', (cb) => cb.primaryKey())
    .addColumn('name', 'text', (cb) => cb.notNull())
    .addColumn('size', 'bigint', (cb) => cb.notNull())
    .addColumn('width', 'integer', (cb) => cb.notNull())
    .addColumn('height', 'integer', (cb) => cb.notNull())
    .addColumn('type', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('cover', 'boolean', (cb) => cb.notNull().defaultTo(false))
    .addColumn('thumb_hash', 'text')
    .execute()

  await db.schema
    .createTable('galrc_other_media')
    .ifNotExists()
    .addColumn('id', 'serial', (cb) => cb.primaryKey())
    .addColumn('other_id', 'integer', (cb) =>
      cb.notNull().references('galrc_other.id').onDelete('cascade'),
    )
    .addColumn('media_hash', 'text', (cb) =>
      cb.notNull().references('galrc_media.hash').onDelete('cascade'),
    )
    .addColumn('sort_order', 'integer', (cb) => cb.notNull())
    .addColumn('createdAt', sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`),
    )
    .addColumn('updatedAt', sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`),
    )
    .addColumn('cover', 'boolean', (cb) => cb.notNull().defaultTo(false))
    .execute()

  await db.schema
    .createTable('galrc_cloudflare')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('a_email', 'text', (cb) => cb.notNull())
    .addColumn('a_key', 'text', (cb) => cb.notNull())
    .addColumn('account_id', 'text', (cb) => cb.notNull())
    .addColumn('woker_name', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('url_endpoint', 'text')
    .addColumn('state', 'boolean', (cb) => cb.notNull().defaultTo(true))
    .addColumn('enable', 'boolean', (cb) => cb.notNull().defaultTo(false))
    .addColumn('duration', 'float8', (cb) => cb.notNull().defaultTo(0))
    .addColumn('errors', 'bigint', (cb) => cb.notNull().defaultTo(0))
    .addColumn('requests', 'bigint', (cb) => cb.notNull().defaultTo(0))
    .addColumn('responseBodySize', 'bigint', (cb) => cb.notNull().defaultTo(0))
    .addColumn('subrequests', 'bigint', (cb) => cb.notNull().defaultTo(0))
    .addColumn('updateTime', 'timestamp')
    .execute()

  await db.schema
    .createTable('galrc_siteConfig')
    .ifNotExists()
    .addColumn('key', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('config', 'jsonb')
    .execute()

  await db.schema
    .createTable('galrc_alistb')
    .ifNotExists()
    .addColumn('id', 'varchar(512)', (cb) => cb.notNull().primaryKey())
    .addColumn('vid', 'varchar(255)')
    .addColumn('other', 'bigint')
    .addColumn('path', 'jsonb')
    .execute()

  await db.schema
    .createTable('galrc_article')
    .ifNotExists()
    .addColumn('id', 'serial', (cb) => cb.primaryKey())
    .addColumn('vid', 'varchar(255)')
    .addColumn('otherid', 'bigint')
    .addColumn('author', 'text')
    .addColumn('title', 'varchar(255)')
    .addColumn('content', 'text')
    .addColumn('copyright', 'text')
    .addColumn('type', 'varchar(255)')
    .addColumn('createdAt', sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`),
    )
    .addColumn('updatedAt', sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`),
    )
    .execute()

  await db.schema
    .createTable('galrc_zhtag')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (cb) => cb.notNull().primaryKey())
    .addColumn('name', 'text')
    .addColumn('alias', 'text')
    .addColumn('description', 'text')
    .addColumn('exhibition', 'boolean', (cb) => cb.notNull().defaultTo(true))
    .execute()

  await db.schema
    .createTable('galrc_gameDownloadStats')
    .ifNotExists()
    .addColumn('id', 'serial', (cb) => cb.notNull().primaryKey())
    .addColumn('game_id', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('file_path', 'text', (cb) => cb.notNull())
    .addColumn('created_at', 'timestamp', (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull(),
    )
    .execute()

  await db.schema
    .createTable('galrc_collections')
    .ifNotExists()
    .addColumn('id', 'serial', (cb) => cb.notNull().primaryKey())
    .addColumn('title', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('alias', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('description', 'text')
    .execute()

  await db.schema
    .createTable('galrc_collectionsItems')
    .ifNotExists()
    .addColumn('id', 'serial', (cb) => cb.notNull().primaryKey())
    .addColumn('collection_id', 'bigint', (cb) => cb.notNull())
    .addColumn('game_id', 'varchar(255)', (cb) => cb.notNull())
    .execute()

  await vndbDb.schema
    .createIndex('tags_vn_tag_index')
    .ifNotExists()
    .on('tags_vn')
    .column('tag')
    .execute()
  await vndbDb.schema
    .createIndex('vn_c_image_index')
    .ifNotExists()
    .on('vn')
    .column('c_image')
    .execute()
  await vndbDb.schema
    .createIndex('releases_titles_index')
    .ifNotExists()
    .on('releases_titles')
    .column('id')
    .execute()
  await vndbDb.schema
    .createIndex('vn_titles_index')
    .ifNotExists()
    .on('vn_titles')
    .column('id')
    .execute()
  await vndbDb.schema
    .createIndex('tags_vn_vid_index')
    .ifNotExists()
    .on('tags_vn')
    .column('vid')
    .execute()
  await vndbDb.schema
    .createIndex('tags_id_index')
    .ifNotExists()
    .on('tags')
    .column('id')
    .execute()
  await vndbDb.schema
    .createIndex('releases_producers_index')
    .ifNotExists()
    .on('releases_producers')
    .column('id')
    .column('pid')
    .execute()
  await vndbDb.schema
    .createIndex('releases_producers_pid_index')
    .ifNotExists()
    .on('releases_producers')
    .column('pid')
    .execute()
  await vndbDb.schema
    .createIndex('producers_index')
    .ifNotExists()
    .on('producers')
    .column('id')
    .execute()
  await vndbDb.schema
    .createIndex('producers_relations_index')
    .ifNotExists()
    .on('producers_relations')
    .column('id')
    .column('pid')
    .execute()

  await db.schema
    .createIndex('galrc_article_vid')
    .ifNotExists()
    .on('galrc_article')
    .column('vid')
    .execute()
  await db.schema
    .createIndex('galrc_article_otherid')
    .ifNotExists()
    .on('galrc_article')
    .column('otherid')
    .execute()
  await db.schema
    .createIndex('galrc_article_type')
    .ifNotExists()
    .on('galrc_article')
    .column('type')
    .execute()
  await db.schema
    .createIndex('galrc_alistb_vid_index')
    .ifNotExists()
    .on('galrc_alistb')
    .column('vid')
    .execute()
  await db.schema
    .createIndex('galrc_alistb_other_index')
    .ifNotExists()
    .on('galrc_alistb')
    .column('other')
    .execute()
  await db.schema
    .createIndex('galrc_media_hash_index')
    .ifNotExists()
    .on('galrc_media')
    .column('hash')
    .execute()
  await db.schema
    .createIndex('galrc_other_status_index')
    .ifNotExists()
    .on('galrc_other')
    .column('status')
    .execute()
  await db.schema
    .createIndex('galrc_user_email_index')
    .ifNotExists()
    .on('galrc_user')
    .column('email')
    .execute()
  await db.schema
    .createIndex('galrc_accounts_userId_index')
    .ifNotExists()
    .on('galrc_account')
    .column('userId')
    .execute()
  await db.schema
    .createIndex('galrc_account_userId-token_index')
    .ifNotExists()
    .on('galrc_session')
    .columns(['userId', 'token'])
    .execute()
  await db.schema
    .createIndex('galrc_siteConfig_key_index')
    .ifNotExists()
    .on('galrc_siteConfig')
    .column('key')
    .execute()
  await db.schema
    .createIndex('galrc_gameDownloadStats_game_id_index')
    .ifNotExists()
    .on('galrc_gameDownloadStats')
    .column('game_id')
    .execute()
  await db.schema
    .createIndex('galrc_gameDownloadStats_file_path_index')
    .ifNotExists()
    .on('galrc_gameDownloadStats')
    .column('file_path')
    .execute()
}
