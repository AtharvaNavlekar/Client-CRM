import { db, setDatabaseConnected } from './client';
import { sql } from 'drizzle-orm';
import { execSync } from 'child_process';
import { logger } from '../infrastructure/logger';

export interface DatabaseDiagnosticResult {
  connected: boolean;
  usersTableExists: boolean;
  missingColumns: string[];
  userCount: number;
  errorCategory?: 'CONNECTION_FAILURE' | 'SCHEMA_NOT_MIGRATED' | 'COLUMN_MISMATCH' | 'NONE';
  details?: string;
}

const REQUIRED_USER_COLUMNS = [
  'id',
  'tenant_id',
  'name',
  'email',
  'role',
  'is_platform_staff',
  'password_hash',
  'avatar',
  'title',
  'phone',
  'team_id',
  'manages_team_ids'
];

/**
 * Ensures PostgreSQL service is started locally if running on localhost.
 */
export function ensurePostgresServiceRunning(): boolean {
  try {
    execSync('pg_isready -h 127.0.0.1 -p 5432 -t 2', { stdio: 'ignore' });
    return true;
  } catch {
    // Attempt to start local cluster if installed
    try {
      logger.warn('[DB DIAGNOSTICS] PostgreSQL is not accepting connections. Attempting cluster startup...');
      execSync('pg_ctlcluster 15 main start || service postgresql start', { stdio: 'ignore' });
      execSync('pg_isready -h 127.0.0.1 -p 5432 -t 5', { stdio: 'ignore' });
      logger.info('[DB DIAGNOSTICS] PostgreSQL local cluster started successfully.');
      return true;
    } catch (e: any) {
      logger.error('[DB DIAGNOSTICS] Unable to start local PostgreSQL cluster:', e?.message || e);
      return false;
    }
  }
}

/**
 * Validates database connectivity, presence of the 'users' table, and column integrity.
 */
export async function runDatabaseDiagnostics(): Promise<DatabaseDiagnosticResult> {
  const result: DatabaseDiagnosticResult = {
    connected: false,
    usersTableExists: false,
    missingColumns: [],
    userCount: 0,
    errorCategory: 'NONE'
  };

  // 1. Verify SELECT 1
  try {
    await db.execute(sql`SELECT 1`);
    result.connected = true;
    setDatabaseConnected(true);
  } catch (err: any) {
    setDatabaseConnected(false);
    result.errorCategory = 'CONNECTION_FAILURE';
    result.details = err?.code === 'ECONNREFUSED' 
      ? 'Connection refused at localhost:5432. PostgreSQL is not running or unreachable.' 
      : `Connection error: ${err?.message || 'Unknown error'}`;
    logger.error(`[DB DIAGNOSTICS] Database connection failed [${result.errorCategory}]: ${result.details}`);
    return result;
  }

  // 2. Verify whether 'users' table exists in public schema
  try {
    const tableCheck: any = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    
    const rows = Array.isArray(tableCheck) ? tableCheck : (tableCheck?.rows || []);
    result.usersTableExists = rows.length > 0;

    if (!result.usersTableExists) {
      result.errorCategory = 'SCHEMA_NOT_MIGRATED';
      result.details = 'The "users" table is missing. Drizzle migrations have not been applied.';
      logger.error(`[DB DIAGNOSTICS] Schema check failed [${result.errorCategory}]: ${result.details}`);
      return result;
    }
  } catch (err: any) {
    result.errorCategory = 'SCHEMA_NOT_MIGRATED';
    result.details = `Failed to query information_schema.tables: ${err?.message}`;
    logger.error(`[DB DIAGNOSTICS] Schema check failed: ${result.details}`);
    return result;
  }

  // 3. Verify actual columns of public.users against schema.ts & 0000_adorable_mentor.sql
  try {
    const colCheck: any = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);

    const colRows = Array.isArray(colCheck) ? colCheck : (colCheck?.rows || []);
    const existingCols = new Set(colRows.map((r: any) => r.column_name));
    
    result.missingColumns = REQUIRED_USER_COLUMNS.filter(col => !existingCols.has(col));

    if (result.missingColumns.length > 0) {
      result.errorCategory = 'COLUMN_MISMATCH';
      result.details = `Columns missing from public.users: ${result.missingColumns.join(', ')}`;
      logger.error(`[DB DIAGNOSTICS] Column validation failed [${result.errorCategory}]: ${result.details}`);
      return result;
    }
  } catch (err: any) {
    result.details = `Failed to check columns: ${err?.message}`;
    logger.error(`[DB DIAGNOSTICS] Column check error: ${result.details}`);
  }

  // 4. Check user count
  try {
    const countCheck: any = await db.execute(sql`SELECT count(*)::int as count FROM users`);
    const countRows = Array.isArray(countCheck) ? countCheck : (countCheck?.rows || []);
    result.userCount = countRows[0]?.count || 0;
    
    if (result.userCount === 0 && process.env.NODE_ENV !== 'production') {
      logger.warn('[DB DIAGNOSTICS] Table "users" is empty. Run "npm run db:seed" to load development accounts.');
    } else {
      logger.info(`[DB DIAGNOSTICS] Database healthy. Table "users" verified with ${result.userCount} records.`);
    }
  } catch (err: any) {
    logger.warn(`[DB DIAGNOSTICS] User count query error: ${err?.message}`);
  }

  return result;
}
