import { db, sql } from "@/lib/kysely";

export async function seed() {
  // 创建 better 表
  await db.schema
    .createTable("galrc_user")
    .ifNotExists()
    .addColumn("id", "text", (cb) => cb.primaryKey())
    .addColumn("name", "varchar(255)", (cb) => cb.notNull())
    .addColumn("email", "varchar(255)", (cb) => cb.notNull().unique())
    .addColumn("emailVerified", "boolean", (cb) =>
      cb.notNull().defaultTo(false)
    )
    .addColumn("image", "varchar(255)")
    .addColumn("role", "varchar(10)", (cb) =>
      cb
        .notNull()
        .defaultTo("user")
        .check(sql`role IN ('user', 'admin')`)
    )
    .addColumn("banned", "boolean", (cb) => cb.notNull().defaultTo(false))
    .addColumn("ban_reason", "text")
    .addColumn("ban_expires", "timestamp")
    .addColumn("createdAt", sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`)
    )
    .addColumn("updatedAt", sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`)
    )
    .execute();

  await db.schema
    .createTable("galrc_session")
    .ifNotExists()
    .addColumn("id", "text", (cb) => cb.primaryKey())

    .addColumn("userId", "varchar(255)", (cb) =>
      cb.notNull().references("galrc_user.id")
    )
    .addColumn("token", "varchar(255)", (cb) => cb.notNull().unique())
    .addColumn("expiresAt", sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`)
    )
    .addColumn("ipAddress", "varchar(255)")
    .addColumn("userAgent", "varchar(255)")
    .addColumn("createdAt", sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`)
    )
    .addColumn("updatedAt", sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`)
    )
    .execute();

  await db.schema
    .createTable("galrc_account")
    .ifNotExists()
    .addColumn("id", "text", (cb) => cb.primaryKey())
    .addColumn(
      "userId",
      "varchar(255)",
      (cb) => cb.notNull().references("galrc_user.id").onDelete("cascade") // FK 关联到 users.id
    )
    .addColumn("accountId", "varchar(255)") // SSO 或本地账户 ID
    .addColumn("providerId", "varchar(255)") // 认证提供商（如 "google", "credentials"）
    .addColumn("accessToken", "text") // 可选
    .addColumn("refreshToken", "text") // 可选
    .addColumn("accessTokenExpiresAt", "timestamp") // 可选
    .addColumn("refreshTokenExpiresAt", "timestamp") // 可选
    .addColumn("scope", "text") // 可选
    .addColumn("idToken", "text") // 可选
    .addColumn("password", "text") // 仅用于邮箱/密码登录
    .addColumn("createdAt", "timestamp", (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull()
    )
    .addColumn("updatedAt", "timestamp", (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull()
    )
    // 可选：为 userId 和 providerId 添加复合唯一约束（确保一个用户每个提供商只有一个账户）
    .addUniqueConstraint("accounts_userId_providerId_unique", [
      "userId",
      "providerId",
    ])
    .execute();

  await db.schema
    .createTable("galrc_verification")
    .ifNotExists()
    .addColumn("id", "text", (cb) => cb.primaryKey())
    .addColumn("identifier", "varchar(255)", (cb) => cb.notNull()) // 验证请求标识符
    .addColumn("value", "varchar(255)", (cb) => cb.notNull()) // 待验证的值
    .addColumn("expiresAt", "timestamp", (cb) => cb.notNull()) // 过期时间
    .addColumn("createdAt", "timestamp", (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull()
    )
    .addColumn("updatedAt", "timestamp", (cb) =>
      cb.defaultTo(sql`current_timestamp`).notNull()
    )
    .execute();

  // 创建 Galrc 部分表

  await db.schema
    .createTable("galrc_media")
    .ifNotExists()
    .addColumn("id", "bigint", (cb) => cb.primaryKey())
    .addColumn("meidiaUrl", "text", (cb) => cb.notNull())
    .addColumn("type", "varchar(255)", (cb) => cb.notNull())
    .addColumn("Preview", "text")
    .addColumn("ThumbHash", "text", (cb) => cb.notNull())
    .addColumn("Hash", "text", (cb) => cb.notNull())
    .addColumn("Cover", "bigint")
    .execute();

  await db.schema
    .createTable("galrc_other")
    .ifNotExists()
    .addColumn("id", "bigint", (cb) => cb.primaryKey())
    .addColumn("vid", "varchar(255)", (cb) => cb.references("vn.id"))
    .addColumn("onthermeidia", "bigint", (cb) =>
      cb.references("galrc_media.id")
    )
    .addColumn("title", "text")
    .addColumn("alias", "text")
    .addColumn("Introduction", "text")
    .addColumn("description", "text")
    .execute();

  await db.schema
    .createTable("galrc_cloudflare")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("a_email", "text", (cb) => cb.notNull())
    .addColumn("a_key", "text", (cb) => cb.notNull())
    .addColumn("account_id", "text", (cb) => cb.notNull())
    .addColumn("woker_name", "varchar(255)", (cb) => cb.notNull())
    .addColumn("url_endpoint", "text")
    .addColumn("state", "boolean", (cb) => cb.notNull().defaultTo(true))
    .addColumn("enable", "boolean", (cb) => cb.notNull().defaultTo(false))
    .addColumn("duration", "float8", (cb) => cb.notNull().defaultTo(0))
    .addColumn("errors", "bigint", (cb) => cb.notNull().defaultTo(0))
    .addColumn("requests", "bigint", (cb) => cb.notNull().defaultTo(0))
    .addColumn("responseBodySize", "bigint", (cb) => cb.notNull().defaultTo(0))
    .addColumn("subrequests", "bigint", (cb) => cb.notNull().defaultTo(0))
    .addColumn("updateTime", "timestamp")
    .execute();

  await db.schema
    .createTable("galrc_siteConfig")
    .ifNotExists()
    .addColumn("key", "varchar(255)", (col) => col.primaryKey())
    .addColumn(" config", "jsonb")
    .execute();

  await db.schema
    .createTable("galrc_alistb")
    .ifNotExists()
    .addColumn("id", "varchar(512)", (cb) => cb.notNull().primaryKey())
    .addColumn("vid", "varchar(255)")
    .addColumn("other", "bigint")
    .execute();

  // 索引
  await db.schema
    .createIndex("galrc_user_email_index")
    .ifNotExists()
    .on("galrc_user")
    .column("email")
    .execute();
  await db.schema
    .createIndex("galrc_accounts_userId_index")
    .ifNotExists()
    .on("galrc_account")
    .column("userId")
    .execute();
  await db.schema
    .createIndex("galrc_account_userId-token_index")
    .ifNotExists()
    .on("galrc_session")
    .columns(["userId", "token"])
    .execute();
  await db.schema
    .createIndex("galrc_siteConfig_key_index")
    .ifNotExists()
    .on("galrc_siteConfig")
    .column("key")
    .execute();
}

seed();
