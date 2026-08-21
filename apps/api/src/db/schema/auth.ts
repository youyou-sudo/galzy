import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

// galrc_user — Better Auth users table
export const users = pgTable(
  'galrc_user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: boolean('emailVerified').notNull().default(false),
    image: text('image'),
    role: varchar('role', { length: 10 }).notNull().default('user'),
    banned: boolean('banned').notNull().default(false),
    banReason: text('ban_reason'),
    banExpires: timestamp('ban_expires'),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    roleIdx: index('idx_galrc_user_role').on(table.role),
    createdAtIdx: index('idx_galrc_user_created_at').on(table.createdAt),
  }),
)

// galrc_session
export const sessions = pgTable(
  'galrc_session',
  {
    id: text('id').primaryKey(),
    userId: varchar('userId', { length: 255 })
      .notNull()
      .references(() => users.id),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).defaultNow(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    impersonatedBy: text('impersonatedBy'),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index('idx_galrc_session_user_id').on(table.userId),
    createdAtIdx: index('idx_galrc_session_created_at').on(table.createdAt),
  }),
)

// galrc_account
export const accounts = pgTable(
  'galrc_account',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    issuer: text('issuer').notNull(),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
    scope: text('scope'),
    idToken: text('idToken'),
    password: text('password'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_galrc_account_user_id').on(table.userId),
    providerIdIdx: index('idx_galrc_account_provider_id').on(table.providerId),
    createdAtIdx: index('idx_galrc_account_created_at').on(table.createdAt),
  }),
)

// galrc_verification
export const verifications = pgTable(
  'galrc_verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    identifierIdx: index('idx_galrc_verification_identifier').on(
      table.identifier,
    ),
    createdAtIdx: index('idx_galrc_verification_created_at').on(
      table.createdAt,
    ),
  }),
)
