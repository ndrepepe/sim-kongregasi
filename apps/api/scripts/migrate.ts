import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL belum diatur.');
  const client = new Client({ connectionString });
  await client.connect();
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir = resolve(process.cwd(), 'db/migrations');
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const exists = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
    if (exists.rowCount) continue;
    const sql = await readFile(resolve(dir, file), 'utf8');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(filename) VALUES($1) ON CONFLICT DO NOTHING', [file]);
    console.log(`Migrasi diterapkan: ${file}`);
  }
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
