// Applies db/schema.sql using the direct (unpooled) connection.
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by 1",
  )
  console.log('Schema applied. Tables:', rows.map((r) => r.table_name).join(', '))
} finally {
  await client.end()
}
