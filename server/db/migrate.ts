import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, queryClient } from './client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs pending Drizzle migrations using the PostgreSQL client.
 * Safe and idempotent.
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.resolve(__dirname, 'migrations');
  console.log(`[MIGRATION] Applying PostgreSQL migrations from: ${migrationsFolder}`);
  
  await migrate(db, { migrationsFolder });
  console.log('[MIGRATION] All Drizzle migrations verified and applied successfully.');
}

// Direct execution entrypoint (e.g., via `npm run db:migrate`)
if (process.argv[1] && (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'))) {
  runMigrations()
    .then(async () => {
      console.log('[MIGRATION] Database schema migration completed successfully.');
      await queryClient.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('[MIGRATION FAILED]:', error);
      await queryClient.end();
      process.exit(1);
    });
}
