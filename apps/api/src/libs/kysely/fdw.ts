import { db, sql } from './webData'

export const dbFdw = async () => {
  await sql`
    CREATE EXTENSION IF NOT EXISTS postgres_fdw;
  `.execute(db)

  const vndbUrl = new URL(process.env.VNDB_DATABASE_URL!)
  const host = vndbUrl.hostname
  const port = vndbUrl.port
  const dbname = vndbUrl.pathname.replace(/^\//, '')
  const user = vndbUrl.username
  const password = vndbUrl.password

  const databaseUrl = new URL(process.env.DATABASE_URL!)
  const databaseUrluser = databaseUrl.username

  await sql`
    DROP SERVER IF EXISTS vndb_server CASCADE;
  `.execute(db)

  await sql`
    CREATE SERVER vndb_server
      FOREIGN DATA WRAPPER postgres_fdw
      OPTIONS (
        host '${sql.raw(host)}',
        port '${sql.raw(port)}',
        dbname '${sql.raw(dbname)}'
      );
  `.execute(db)

  await sql`
    CREATE USER MAPPING IF NOT EXISTS FOR ${sql.raw(databaseUrluser)}
      SERVER vndb_server
      OPTIONS (
        user '${sql.raw(user)}',
        password '${sql.raw(password)}'
      );
  `.execute(db)

  await sql`
    CREATE FOREIGN TABLE IF NOT EXISTS vn (
      id          text,
      image       text,
      c_image     text,
      olang       text,
      c_votecount integer,
      c_rating    smallint,
      c_average   smallint,
      length      smallint,
      devstatus   smallint,
      alias       text,
      description text
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
      lang     text,
      official boolean,
      title    text,
      latin    text
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
      cat          text,
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
      uid         text,
      vote        integer,
      spoiler     integer,
      ignore      boolean,
      lie         boolean,
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
      olang          text,
      released       integer,
      voiced         integer,
      reso_x         integer,
      reso_y         integer,
      minage         smallint,
      ani_story      smallint,
      ani_ero        smallint,
      ani_story_sp   smallint,
      ani_story_cg   smallint,
      ani_cutscene   smallint,
      ani_ero_sp     smallint,
      ani_ero_cg     smallint,
      ani_bg         boolean,
      ani_face       boolean,
      has_ero        boolean,
      patch          boolean,
      freeware       boolean,
      uncensored     boolean,
      official       boolean,
      catalog        text,
      engine         text,
      notes          text,
      title          text
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
      id   text,
      lang text,
      mtl  boolean,
      title text,
      latin text
    )
    SERVER vndb_server
    OPTIONS (
      schema_name 'public',
      table_name  'releases_titles'
    );
  `.execute(db)

  await sql`
    CREATE FOREIGN TABLE IF NOT EXISTS producers (
      id  text,
      type text,
      lang text,
      name text,
      latin text,
      alias text,
      description  text
    )
    SERVER vndb_server
    OPTIONS (
      schema_name 'public',
      table_name  'producers'
    );
  `.execute(db)

  await sql`
    CREATE FOREIGN TABLE IF NOT EXISTS releases_producers (
      id  text,
      pid text,
      developer  boolean,
      publisher boolean
    )
    SERVER vndb_server
    OPTIONS (
      schema_name 'public',
      table_name  'releases_producers'
    );
  `.execute(db)

  await sql`
    CREATE FOREIGN TABLE IF NOT EXISTS producers_relations (
      id  text,
      pid text,
      relation  text
    )
    SERVER vndb_server
    OPTIONS (
      schema_name 'public',
      table_name  'producers_relations'
    );
  `.execute(db)
}
