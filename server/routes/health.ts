import express from 'express';
import { db } from '../db/client';
import { sql } from 'drizzle-orm';
import { redisService } from '../infrastructure/redis';
import { metricsRegistry } from '../infrastructure/metrics';

export const healthRouter = express.Router();

// LIVENESS: "Is the process alive?"
// Fails only if the event loop is blocked or process is dead.
healthRouter.get('/live', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// READINESS: "Can this instance safely serve traffic?"
// Checks critical dependencies (DB, Redis)
healthRouter.get('/ready', async (req, res) => {
  let isReady = true;
  const checks: any = {};

  // Check Postgres
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = 'UP';
  } catch (error) {
    checks.database = 'DOWN';
    isReady = false;
  }

  // Check Redis (optional infrastructure with in-memory fallback)
  if (redisService.isAvailable()) {
    checks.redis = 'UP';
  } else if (redisService.isDegraded()) {
    checks.redis = 'IN_MEMORY_FALLBACK';
  } else {
    checks.redis = 'DOWN';
    isReady = false;
  }

  const status = isReady ? 'ok' : 'error';
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    status,
    database: checks.database === 'UP',
    checks
  });
});

// METRICS EXPORT
healthRouter.get('/metrics', (req, res) => {
  // Normally protected by internal network or basic auth.
  // Assuming network isolation for this endpoint.
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metricsRegistry.metrics());
});
