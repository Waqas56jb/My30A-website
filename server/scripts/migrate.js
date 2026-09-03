import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const migrationsDir = path.resolve(__dirname, '../../supabase/migrations')

function hasExecutableSql(sql) {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .trim()
  return stripped.length > 0
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_POOLER_URL,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id serial PRIMARY KEY,
      filename text UNIQUE NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const files = fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort()

  for (const filename of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8')

    if (!hasExecutableSql(sql)) {
      console.log(`skip (empty) ${filename}`)
      continue
    }

    const { rows } = await client.query(
      'SELECT 1 FROM _migrations WHERE filename = $1',
      [filename]
    )

    if (rows.length) {
      console.log(`skip ${filename}`)
      continue
    }

    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [filename])
      await client.query('COMMIT')
      console.log(`applied ${filename}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }

  const { rows: counts } = await client.query(`
    SELECT
      (SELECT count(*)::int FROM communities) AS communities,
      (SELECT count(*)::int FROM transfer_pricing) AS transfer_pricing,
      (SELECT count(*)::int FROM settings) AS settings
  `)

  console.log('verification', counts[0])
} finally {
  await client.end()
}
