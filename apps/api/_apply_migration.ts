import { readFileSync } from 'fs';
import { Pool } from 'pg';

const sql = readFileSync('./drizzle/0001_tired_dazzler.sql', 'utf-8');
const statements = sql
  .split('--> statement-breakpoint')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`Found ${statements.length} statements to execute`);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let success = 0;
let failed = 0;

for (const stmt of statements) {
  try {
    await pool.query(stmt);
    console.log(`✓ ${stmt.substring(0, 80)}...`);
    success++;
  } catch (err: any) {
    // If the index already exists, skip
    if (err.code === '42P16' || err.message?.includes('already exists')) {
      console.log(`~ ${stmt.substring(0, 80)}... (already exists)`);
      success++;
    } else {
      console.error(`✗ ${stmt.substring(0, 80)}...`);
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }
}

console.log(`\nDone: ${success} succeeded, ${failed} failed`);
await pool.end();
process.exit(failed > 0 ? 1 : 0);
