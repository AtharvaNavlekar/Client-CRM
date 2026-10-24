import { runMigrations } from './migrate';
import { provisionDevelopmentData } from './provisionDev';
import { db } from './client';
import { sql } from 'drizzle-orm';

import { execSync } from 'child_process';
import fs from 'fs';

function ensurePostgresRunning() {
  if (fs.existsSync('/app/pgdata')) {
    try {
      execSync('mkdir -p /var/run/postgresql && chown -R postgres:postgres /var/run/postgresql', { stdio: 'ignore' });
      execSync('su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /app/pgdata -l /app/pgdata/logfile start"', { stdio: 'ignore' });
    } catch {
      // already running or managed externally
    }
  }
}

/**
 * Initializes the database on server startup.
 * Ensures connectivity, executes pending migrations, and runs idempotent dev provisioning.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    ensurePostgresRunning();
    // 1. Verify connection
    await db.execute(sql`SELECT 1 as connected`);
    console.log('[DB] PostgreSQL connection established.');

    // 2. Run Drizzle migrations
    await runMigrations();

    // 3. Run development provisioning if in development mode
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      await provisionDevelopmentData();
    }
  } catch (err: any) {
    console.error('[DB INIT ERROR]: Failed to initialize database:', err);
    if (process.env.NODE_ENV === 'development') {
      console.warn('[DB INIT WARNING]: Server continuing with degraded database connectivity.');
    }
  }
}
