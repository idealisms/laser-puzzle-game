#!/usr/bin/env bash
# Dump every table in the production database to JSON files for local analysis.
# Usage: scripts/dump-prod-db.sh [output-dir]   (default: db-dump/)
# Reads DATABASE_URL from .env.production; the session is read-only.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT_DIR="${1:-db-dump}"
mkdir -p "$OUT_DIR"

OUT_DIR="$OUT_DIR" node - <<'EOF'
require('dotenv').config({ path: '.env.production', quiet: true });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set in .env.production');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');

  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name <> '_prisma_migrations'
     ORDER BY table_name`
  );

  for (const { table_name } of tables) {
    const { rows } = await client.query(`SELECT * FROM "${table_name}"`);
    const file = path.join(process.env.OUT_DIR, `${table_name}.json`);
    fs.writeFileSync(file, JSON.stringify(rows, null, 2));
    console.log(`${table_name}: ${rows.length} rows -> ${file}`);
  }

  await client.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
EOF
