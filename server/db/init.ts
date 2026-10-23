import { runMigrations } from './migrate';
import { provisionDevelopmentData } from './provisionDev';
import { db } from './client';
import { sql } from 'drizzle-orm';

/**
 * Initializes the database on server startup.
 * Ensures connectivity, executes pending migrations, and runs idempotent dev provisioning.
 */
export async function initializeDatabase(): Promise<void> {
  try {
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
