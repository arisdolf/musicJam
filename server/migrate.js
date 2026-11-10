/**
 * migrate.js — Applies server/schema.sql to the configured PostgreSQL database.
 *
 * Usage:
 *   node server/migrate.js           # reads DATABASE_URL from .env or environment
 *
 * Safe to run multiple times; every DDL statement is idempotent.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

// ── Load .env from the project root (skipped in hosted envs that set vars directly) ──
const __dirname = dirname(fileURLToPath(import.meta.url))
const localEnvPath = resolve(__dirname, '../.env')
if (existsSync(localEnvPath)) process.loadEnvFile(localEnvPath)

// ── Validate required env vars ────────────────────────────────────────────────
const { DATABASE_URL } = process.env
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set. Add it to .env or export it in your environment.')
  process.exit(1)
}

// ── Connect ───────────────────────────────────────────────────────────────────
const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
const { Pool } = pg
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

console.log(`\n🔌  Connecting to ${isLocal ? 'local' : 'remote'} database…`)
try {
  await pool.query('SELECT 1')
  console.log('✅  Connected.\n')
} catch (err) {
  console.error('❌  Could not connect to the database:', err.message)
  await pool.end()
  process.exit(1)
}

// ── Read and apply schema.sql ─────────────────────────────────────────────────
const schemaPath = resolve(__dirname, 'schema.sql')
if (!existsSync(schemaPath)) {
  console.error('❌  schema.sql not found at', schemaPath)
  await pool.end()
  process.exit(1)
}

const sql = readFileSync(schemaPath, 'utf8')
console.log('📐  Applying schema.sql…')

try {
  await pool.query(sql)
  console.log('✅  Schema applied successfully.\n')
} catch (err) {
  console.error('❌  Schema error:', err.message)
  await pool.end()
  process.exit(1)
}

// ── Print a summary of the resulting schema ───────────────────────────────────
const { rows: tables } = await pool.query(`
  SELECT t.table_name,
         COUNT(c.column_name)::int AS columns
  FROM information_schema.tables t
  JOIN information_schema.columns c
    ON c.table_name = t.table_name AND c.table_schema = t.table_schema
  WHERE t.table_schema = 'public'
    AND t.table_type  = 'BASE TABLE'
  GROUP BY t.table_name
  ORDER BY t.table_name
`)

const { rows: indexes } = await pool.query(`
  SELECT tablename, indexname
  FROM   pg_indexes
  WHERE  schemaname = 'public'
  ORDER  BY tablename, indexname
`)

console.log('📊  Tables:')
for (const t of tables) {
  const tIdx = indexes.filter(i => i.tablename === t.table_name).map(i => i.indexname)
  console.log(`    • ${t.table_name.padEnd(20)} ${t.columns} cols   indexes: ${tIdx.join(', ')}`)
}

const { rows: fks } = await pool.query(`
  SELECT tc.table_name, kcu.column_name,
         ccu.table_name  AS ref_table,
         ccu.column_name AS ref_col,
         rc.delete_rule
  FROM information_schema.table_constraints      tc
  JOIN information_schema.key_column_usage       kcu ON kcu.constraint_name = tc.constraint_name
  JOIN information_schema.referential_constraints rc  ON rc.constraint_name  = tc.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = rc.unique_constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema    = 'public'
  ORDER BY tc.table_name
`)

if (fks.length) {
  console.log('\n🔗  Foreign keys:')
  fks.forEach(r =>
    console.log(`    • ${r.table_name}.${r.column_name} → ${r.ref_table}.${r.ref_col}  (ON DELETE ${r.delete_rule})`)
  )
}

await pool.end()
console.log('\n🎉  Migration complete.')
