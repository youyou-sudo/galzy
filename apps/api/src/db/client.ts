import { drizzle } from 'drizzle-orm/bun-sql';
import { SQL } from 'bun';

const client = new SQL(process.env.DATABASE_URL!);
export const db = drizzle({client});
export { sql } from 'drizzle-orm'
