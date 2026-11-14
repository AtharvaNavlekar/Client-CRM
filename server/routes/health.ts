import express from 'express';
import { db } from '../db/client';
import { sql } from 'drizzle-orm';
import { redisService } from '../infrastructure/redis';
import { metricsRegistry } from '../infrastructure/metrics';
import { requireMetricsAuth } from '../auth';

export const healthRouter = express.Router();

// LIVENESS: "Is the process alive?"
// Fails only if the event loop is blocked or process is dead.
healthRouter.get('/live', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// READINESS: "Can this instance safely serve traffic?"
// Checks critical dependencies (DB, Redis / Rate Limit Store)
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

  const requireRedis =
    process.env.RATE_LIMIT_REQUIRE_REDIS === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.RATE_LIMIT_REQUIRE_REDIS !== 'false');

  // Check Redis
  if (redisService.isAvailable()) {
    const pingOk = await redisService.ping();
    if (pingOk) {
      checks.redis = 'UP';
      checks.rateLimitStore = 'redis';
    } else {
      checks.redis = 'DOWN';
      checks.rateLimitStore = requireRedis ? 'UNAVAILABLE' : 'IN_MEMORY_FALLBACK';
      if (requireRedis) isReady = false;
    }
  } else if (requireRedis) {
    checks.redis = 'DOWN';
    checks.rateLimitStore = 'UNAVAILABLE';
    isReady = false;
  } else if (redisService.isDegraded()) {
    checks.redis = 'IN_MEMORY_FALLBACK';
    checks.rateLimitStore = 'memory';
  } else {
    checks.redis = 'DOWN';
    checks.rateLimitStore = 'UNAVAILABLE';
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
healthRouter.get('/metrics', requireMetricsAuth, (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metricsRegistry.metrics());
});

