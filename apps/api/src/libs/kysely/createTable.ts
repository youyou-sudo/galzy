import { db, sql, vndbDb } from '@api/libs'

export async function dbSeed() {
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
    .addColumn(
      'userId',
      'varchar(255)',
      (cb) => cb.notNull().references('galrc_user.id').onDelete('cascade'), // FK 关联到 users.id
    )
    .addColumn('accountId', 'varchar(255)') // SSO 或本地账户 ID
    .addColumn('providerId', 'varchar(255)') // 认证提供商（如 "google", "credentials"）
    .addColumn('accessToken', 'text') // 可选
    .addColumn('refreshToken', 'text') // 可选
    .addColumn('accessTokenExpiresAt', 'timestamp') // 可选
    .addColumn('refreshTokenExpiresAt', 'timestamp') // 可选
    .addColumn('scope', 'text') // 可选
    .addColumn('idToken', 'text') // 可选
    .addColumn('password', 'text') // 仅用于邮箱/密码登录
    .addColumn('createdAt', 'timestamp', (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull(),
    )
    .addColumn('updatedAt', 'timestamp', (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull(),
    )
    // 可选：为 userId 和 providerId 添加复合唯一约束（确保一个用户每个提供商只有一个账户）
    .addUniqueConstraint('accounts_userId_providerId_unique', [
      'userId',
      'providerId',
    ])
    .execute()

  await db.schema
    .createTable('galrc_verification')
    .ifNotExists()
    .addColumn('id', 'text', (cb) => cb.primaryKey())
    .addColumn('identifier', 'varchar(255)', (cb) => cb.notNull()) // 验证请求标识符
    .addColumn('value', 'varchar(255)', (cb) => cb.notNull()) // 待验证的值
    .addColumn('expiresAt', 'timestamp', (cb) => cb.notNull()) // 过期时间
    .addColumn('createdAt', 'timestamp', (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull(),
    )
    .addColumn('updatedAt', 'timestamp', (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull(),
    )
    .execute()

  // 创建 Galrc 部分表

  await db.schema
    .createTable('galrc_other')
    .ifNotExists()
    .addColumn('id', 'serial', (cb) => cb.primaryKey()) // Changed to serial for auto-increment
    .addColumn('title', 'jsonb') // Changed to jsonb for otherTitle[] array
    .addColumn('alias', 'text')
    .addColumn('introduction', 'text') // Fixed capitalization
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
    .addColumn('cover', 'boolean', (cb) => cb.notNull().defaultTo(false)) // 是否为封面
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
    .addColumn('id', 'varchar(255)', (cb) => cb.notNull().primaryKey())
    .addColumn('game_id', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('file_path', 'text', (cb) => cb.notNull())
    .addColumn('created_at', 'timestamp', (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull(),
    )
    .execute()

  // 索引

  // VNDB
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

  // galrc
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

// 创建 postgres_fdw 扩展
await sql`
  CREATE EXTENSION IF NOT EXISTS postgres_fdw;
`.execute(db)

// 删除已有的远程服务器（如果存在）
await sql`
  DROP SERVER IF EXISTS vndb_server CASCADE;
`.execute(db)
const dbUrl = new URL(process.env.VNDB_DATABASE_URL!)

const host = dbUrl.hostname
const port = dbUrl.port
const dbname = dbUrl.pathname.replace(/^\//, '')
const user = dbUrl.username
const password = dbUrl.password

await sql`
  CREATE SERVER vndb_server
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (
      host '${sql.raw(host)}',
      port '${sql.raw(port)}',
      dbname '${sql.raw(dbname)}'
    );
`.execute(db)

// 创建用户映射
await sql`
  CREATE USER MAPPING FOR ${sql.raw(user)}
    SERVER vndb_server
    OPTIONS (
      user '${sql.raw(user)}',
      password '${sql.raw(password)}'
    );
`.execute(db)

// 创建远程表
await sql`
  CREATE FOREIGN TABLE IF NOT EXISTS vn (
    id          text,
    image       text,       -- 可为空 (deprecated)
    c_image     text,       -- 可为空
    olang       text,
    c_votecount integer,
    c_rating    smallint,   -- 可为空
    c_average   smallint,   -- 可为空
    length      smallint,
    devstatus   smallint,
    alias       text,       -- 可为空
    description text        -- 可为空
  )
  SERVER vndb_server
  OPTIONS (
    schema_name 'public',
    table_name  'vn'
  );
`.execute(db)

await sql`
  CREATE FOREIGN TABLE IF NOT EXISTS vn_titles (
    id       text,
    lang     text,       -- language 类型，可按需映射
    official boolean,
    title    text,
    latin    text        -- 可为空
  )
  SERVER vndb_server
  OPTIONS (
    schema_name 'public',
    table_name  'vn_titles'
  );
`.execute(db)

await sql`
  CREATE FOREIGN TABLE IF NOT EXISTS images (
    id               text,
    width            integer,
    height           integer,
    c_votecount      integer,
    c_sexual_avg     real,
    c_sexual_stddev  real,
    c_violence_avg   real,
    c_violence_stddev real,
    c_weight         real
  )
  SERVER vndb_server
  OPTIONS (
    schema_name 'public',
    table_name  'images'
  );
`.execute(db)

await sql`
  CREATE FOREIGN TABLE IF NOT EXISTS tags (
    id           text,
    cat          text,       -- tag_category 类型，可按需映射
    defaultspoil smallint,
    searchable   boolean,
    applicable   boolean,
    name         text,
    alias        text,
    description  text
  )
  SERVER vndb_server
  OPTIONS (
    schema_name 'public',
    table_name  'tags'
  );
`.execute(db)

await sql`
  CREATE FOREIGN TABLE IF NOT EXISTS tags_vn (
    tag         text,
    vid         text,
    uid         text,       -- 可为空
    vote        integer,
    spoiler     integer,    -- 可为空
    ignore      boolean,
    lie         boolean,    -- 可为空
    notes       text
  )
  SERVER vndb_server
  OPTIONS (
    schema_name 'public',
    table_name  'tags_vn'
  );
`.execute(db)

await sql`
  CREATE FOREIGN TABLE IF NOT EXISTS releases (
    id             text,
    gtin           bigint,
    olang          text,       -- language 类型，可按需映射
    released       integer,
    voiced         integer,
    reso_x         integer,
    reso_y         integer,
    minage         smallint,   -- 可为空
    ani_story      smallint,
    ani_ero        smallint,
    ani_story_sp   smallint,   -- 可为空
    ani_story_cg   smallint,   -- 可为空
    ani_cutscene   smallint,   -- 可为空
    ani_ero_sp     smallint,   -- 可为空
    ani_ero_cg     smallint,   -- 可为空
    ani_bg         boolean,    -- 可为空
    ani_face       boolean,    -- 可为空
    has_ero        boolean,
    patch          boolean,
    freeware       boolean,
    uncensored     boolean,    -- 可为空
    official       boolean,
    catalog        text,
    engine         text,
    notes          text,
    title          text        -- 可为空
  )
  SERVER vndb_server
  OPTIONS (
    schema_name 'public',
    table_name  'releases'
  );
`.execute(db)

await sql`
  CREATE FOREIGN TABLE IF NOT EXISTS releases_vn (
    id  text,
    vid text
  )
  SERVER vndb_server
  OPTIONS (
    schema_name 'public',
    table_name  'releases_vn'
  );
`.execute(db)

await sql`
  CREATE FOREIGN TABLE IF NOT EXISTS releases_titles (
    id  text,
    lang          text,       -- language 类型，可按需映射
    mtl           boolean,
    title         text,       -- 可为空
    latin         text        -- 可为空
  )
  SERVER vndb_server
  OPTIONS (
    schema_name 'public',
    table_name  'releases_titles'
  );
`.execute(db)
