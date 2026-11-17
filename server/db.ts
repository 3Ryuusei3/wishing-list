import { attachDatabasePool } from '@vercel/functions'
import pg from 'pg'

// Neon recommends node-postgres + attachDatabasePool on Vercel (Fluid compute).
// Uses the pooled connection string (-pooler host).
function connectionString() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  // Keep pg's current strict TLS behaviour explicit and silence its sslmode warning.
  return url.replace(/sslmode=(require|prefer|verify-ca)/, 'sslmode=verify-full')
}

let pool: pg.Pool | undefined

export function db() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: connectionString(), max: 5, idleTimeoutMillis: 10_000 })
    attachDatabasePool(pool)
  }
  return pool
}

export async function query<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []) {
  const res = await db().query<T>(text, params)
  return res.rows
}
