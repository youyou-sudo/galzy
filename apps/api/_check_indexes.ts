import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(
  `SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%' ORDER BY indexname`
);
console.log('Existing indexes:', r.rows.length);
r.rows.forEach((row: any) => console.log('  ' + row.indexname + ' on ' + row.tablename));
await pool.end();
