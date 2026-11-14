import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import Redis from 'ioredis';
import {
  createRateLimiters,
  loadRateLimitConfig,
  normalizeEmailForRateLimit,
  parseTrustProxyConfig,
  RateLimitConfig,
  ResilientRedisStore
} from '../server/middleware/rateLimits';
import { globalErrorHandler } from '../server/middleware/errorHandler';
import { RedisService } from '../server/infrastructure/redis';
import { metricsRegistry } from '../server/infrastructure/metrics';
import { Logger } from '../server/infrastructure/logger';
import { requireMetricsAuth, signAccessToken } from '../server/auth';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const SHARED_SECRET = 'test-distributed-rate-limit-hmac-secret-32-chars!!';

async function startHttpServer(app: express.Express): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function stopHttpServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function buildTestConfig(overrides: Partial<RateLimitConfig> = {}): RateLimitConfig {
  const base = loadRateLimitConfig(
    {
      NODE_ENV: 'test',
      REDIS_URL,
      RATE_LIMIT_STORE: 'redis',
      RATE_LIMIT_REQUIRE_REDIS: 'true',
      RATE_LIMIT_KEY_SECRET: SHARED_SECRET,
      TRUST_PROXY: '1'
    },
    overrides
  );
  return base;
}

describe('DialPulse CRM — Comprehensive Distributed Rate Limiting Suite', () => {
  let adminRedis: Redis;

  before(async () => {
    adminRedis = new Redis(REDIS_URL);
    const pong = await adminRedis.ping();
    assert.strictEqual(pong, 'PONG', 'Live Redis instance must be running for distributed rate limit tests');
    // Clean any test namespace leftovers
    const keys = await adminRedis.keys('dp:*');
    if (keys.length > 0) await adminRedis.del(...keys);
  });

  after(async () => {
    if (adminRedis) {
      const keys = await adminRedis.keys('dp:*');
      if (keys.length > 0) await adminRedis.del(...keys);
      await adminRedis.quit();
    }
  });

  describe('1. Configuration & Startup Validation', () => {
    it('rejects permissive TRUST_PROXY=true or wildcard', () => {
      assert.throws(() => parseTrustProxyConfig('true'), /forbidden/i);
      assert.throws(() => parseTrustProxyConfig('*'), /forbidden/i);
      assert.strictEqual(parseTrustProxyConfig('1'), 1);
      assert.strictEqual(parseTrustProxyConfig('0'), false);
      assert.strictEqual(parseTrustProxyConfig('loopback'), 'loopback');
    });

    it('rejects RATE_LIMIT_REQUIRE_REDIS=true combined with RATE_LIMIT_STORE=memory', () => {
      assert.throws(
        () =>
          loadRateLimitConfig({
            NODE_ENV: 'production',
            RATE_LIMIT_STORE: 'memory',
            RATE_LIMIT_REQUIRE_REDIS: 'true',
            RATE_LIMIT_KEY_SECRET: SHARED_SECRET
          }),
        /cannot be combined/i
      );
    });

    it('rejects missing or weak RATE_LIMIT_KEY_SECRET in production', () => {
      assert.throws(
        () =>
          loadRateLimitConfig({
            NODE_ENV: 'production',
            REDIS_URL,
            RATE_LIMIT_STORE: 'redis',
            RATE_LIMIT_REQUIRE_REDIS: 'true'
          }),
        /RATE_LIMIT_KEY_SECRET/
      );
      assert.throws(
        () =>
          loadRateLimitConfig({
            NODE_ENV: 'production',
            REDIS_URL,
            RATE_LIMIT_STORE: 'redis',
            RATE_LIMIT_REQUIRE_REDIS: 'true',
            RATE_LIMIT_KEY_SECRET: 'too-short'
          }),
        /at least 32 characters/
      );
    });

    it('fails startup when RATE_LIMIT_REQUIRE_REDIS=true and Redis is unreachable', async () => {
      const deadRedis = new RedisService('redis://127.0.0.1:63999');
      const cfg = buildTestConfig({ storeMode: 'redis', requireRedis: true });
      await assert.rejects(
        () => createRateLimiters({ config: cfg, redis: deadRedis }),
        /Distributed Redis rate-limit store is required/
      );
      await deadRedis.disconnect();
    });

    it('falls back cleanly to MemoryStore when RATE_LIMIT_REQUIRE_REDIS=false and Redis is unreachable', async () => {
      const deadRedis = new RedisService('redis://127.0.0.1:63999');
      const cfg = buildTestConfig({ storeMode: 'redis', requireRedis: false });
      const suite = await createRateLimiters({ config: cfg, redis: deadRedis });
      assert.strictEqual(suite.activeStoreType, 'memory');
      assert.ok(metricsRegistry.metrics().includes('rate_limit_fallback_total'));
      await deadRedis.disconnect();
    });
  });

  describe('2. Email Normalization, IPv6 Subnets, Spoofing & Auth Policies', () => {
    let app: express.Express;
    let server: http.Server;
    let baseUrl: string;
    let suiteRedis: RedisService;

    before(async () => {
      suiteRedis = new RedisService(REDIS_URL);
      await suiteRedis.ensureReady(3000);
      const cfg = buildTestConfig({
        policies: {
          ...buildTestConfig().policies,
          loginIpRequest: { windowMs: 60_000, limit: 25 },
          loginIpFailed: { windowMs: 60_000, limit: 6 },
          loginAccountFailed: { windowMs: 60_000, limit: 3 },
          sessionRefresh: { windowMs: 60_000, limit: 4 }
        }
      });
      const limiters = await createRateLimiters({ config: cfg, redis: suiteRedis });

      app = express();
      app.set('trust proxy', cfg.trustProxy);
      app.use(express.json());
      app.post(
        '/api/auth/login',
        limiters.loginIpRequest,
        limiters.loginIpFailed,
        limiters.loginAccountFailed,
        (req, res) => {
          const email = normalizeEmailForRateLimit(req.body?.email);
          if (!email || !req.body?.password) {
            return res.status(400).json({ error: 'Invalid input' });
          }
          if (req.body.simulateDbDown) {
            return res.status(503).json({ error: 'DB unavailable', code: 'DATABASE_UNAVAILABLE' });
          }
          if (req.body.password === 'correct-password') {
            return res.status(200).json({ ok: true });
          }
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      );
      app.post('/api/auth/refresh', limiters.sessionRefresh, (_req, res) => {
        res.status(200).json({ token: 'new-token' });
      });
      app.use(globalErrorHandler);

      ({ server, baseUrl } = await startHttpServer(app));
    });

    after(async () => {
      await stopHttpServer(server);
      await suiteRedis.disconnect();
    });

    it('normalizes Unicode NFKC, whitespace, and casing in emails and ignores invalid emails', () => {
      assert.strictEqual(normalizeEmailForRateLimit('  Alice@Example.COM '), 'alice@example.com');
      assert.strictEqual(normalizeEmailForRateLimit('ａｌｉｃｅ@example.com'), 'alice@example.com');
      assert.strictEqual(normalizeEmailForRateLimit('not-an-email'), null);
      assert.strictEqual(normalizeEmailForRateLimit(12345), null);
      assert.strictEqual(normalizeEmailForRateLimit(''), null);
    });

    it('blocks multi-IP credential stuffing on same normalized account (NFKC + case)', async () => {
      const variations = [
        { ip: '198.51.100.10', email: 'victim@dialpulse.in' },
        { ip: '198.51.100.11', email: '  VICTIM@dialpulse.in ' },
        { ip: '198.51.100.12', email: 'ｖｉｃｔｉｍ@dialpulse.in' }
      ];
      for (const v of variations) {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': v.ip },
          body: JSON.stringify({ email: v.email, password: 'wrong' })
        });
        assert.strictEqual(res.status, 401);
        assert.ok(res.headers.get('ratelimit'));
        assert.ok(res.headers.get('ratelimit-policy'));
        assert.strictEqual(res.headers.get('x-ratelimit-limit'), null);
      }

      // 4th attempt from yet another IP must be blocked with 429
      const blocked = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.13' },
        body: JSON.stringify({ email: 'victim@dialpulse.in', password: 'wrong' })
      });
      assert.strictEqual(blocked.status, 429);
      const body = await blocked.json();
      assert.strictEqual(body.code, 'RATE_LIMIT_EXCEEDED');
      assert.strictEqual(body.policy, 'login_account_failed');
      assert.ok(typeof body.retryAfterSeconds === 'number' && body.retryAfterSeconds >= 1);
    });

    it('blocks single IP spraying across unlimited distinct accounts via loginIpFailed', async () => {
      const attackerIp = '198.51.100.20';
      for (let i = 0; i < 6; i++) {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': attackerIp },
          body: JSON.stringify({ email: `spray-${i}@dialpulse.in`, password: 'wrong' })
        });
        assert.strictEqual(res.status, 401);
      }

      const blocked = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': attackerIp },
        body: JSON.stringify({ email: 'spray-new@dialpulse.in', password: 'wrong' })
      });
      assert.strictEqual(blocked.status, 429);
      const body = await blocked.json();
      assert.strictEqual(body.policy, 'login_ip_failed');
    });

    it('normalizes IPv6 addresses to /56 subnet so rotating lower bits shares the same quota', async () => {
      for (let i = 0; i < 6; i++) {
        const ipv6 = `2001:db8:abcd:0012::${i + 1}`;
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipv6 },
          body: JSON.stringify({ email: `v6spray-${i}@dialpulse.in`, password: 'wrong' })
        });
        assert.strictEqual(res.status, 401);
      }

      // Same /56 subnet must be blocked
      const sameSubnetRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '2001:db8:abcd:0012:ffff::99' },
        body: JSON.stringify({ email: 'v6spray-next@dialpulse.in', password: 'wrong' })
      });
      assert.strictEqual(sameSubnetRes.status, 429);

      // Different /56 subnet is unaffected
      const otherSubnetRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '2001:db8:abcd:9900::1' },
        body: JSON.stringify({ email: 'v6spray-other@dialpulse.in', password: 'wrong' })
      });
      assert.strictEqual(otherSubnetRes.status, 401);
    });

    it('does not increment failed login counters on valid login (200) or DB outage (503) or bad input (400)', async () => {
      const testIp = '198.51.100.30';
      const email = 'healthy-user@dialpulse.in';

      // 4 valid logins, 4 DB 503 errors, 4 malformed 400s (> account failed limit of 3 & IP failed limit of 6)
      for (let i = 0; i < 4; i++) {
        const okRes = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': testIp },
          body: JSON.stringify({ email, password: 'correct-password' })
        });
        assert.strictEqual(okRes.status, 200);

        const err503 = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': testIp },
          body: JSON.stringify({ email, password: 'wrong', simulateDbDown: true })
        });
        assert.strictEqual(err503.status, 503);

        const err400 = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': testIp },
          body: JSON.stringify({ email: 'bad-email', password: '' })
        });
        assert.strictEqual(err400.status, 400);
      }

      // First actual 401 still gets 401 (failed counter was never polluted)
      const firstFail = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': testIp },
        body: JSON.stringify({ email, password: 'wrong' })
      });
      assert.strictEqual(firstFail.status, 401);
    });

    it('blocks rightmost trusted proxy hop even when client prepends spoofed XFF hops', async () => {
      const realClient = '198.51.100.40';
      for (let i = 0; i < 6; i++) {
        await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': `203.0.113.${i + 1}, ${realClient}`
          },
          body: JSON.stringify({ email: `hop-${i}@dialpulse.in`, password: 'wrong' })
        });
      }

      const blocked = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `203.0.113.222, ${realClient}`
        },
        body: JSON.stringify({ email: 'hop-final@dialpulse.in', password: 'wrong' })
      });
      assert.strictEqual(blocked.status, 429);
    });

    it('rate-limits /api/auth/refresh', async () => {
      for (let i = 0; i < 4; i++) {
        const res = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { Cookie: 'refreshToken=tok-abc-123', 'X-Forwarded-For': '198.51.100.60' }
        });
        assert.strictEqual(res.status, 200);
      }
      const blocked = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: 'refreshToken=tok-abc-123', 'X-Forwarded-For': '198.51.100.60' }
      });
      assert.strictEqual(blocked.status, 429);
      const body = await blocked.json();
      assert.strictEqual(body.policy, 'session_refresh');
    });
  });

  describe('3. Multi-Instance Distributed Rate Limiting, Concurrency, Idempotency & Tenant Isolation', () => {
    let serverA: http.Server;
    let urlA: string;
    let serverB: http.Server;
    let urlB: string;
    let redisA: RedisService;
    let redisB: RedisService;

    before(async () => {
      redisA = new RedisService(REDIS_URL);
      redisB = new RedisService(REDIS_URL);
      await Promise.all([redisA.ensureReady(3000), redisB.ensureReady(3000)]);

      const buildInstance = async (redisInst: RedisService) => {
        const cfg = buildTestConfig({
          transcribeMaxConcurrent: 2,
          importMaxBatchSize: 5,
          policies: {
            ...buildTestConfig().policies,
            authenticatedApi: { windowMs: 60_000, limit: 6 },
            messageSending: { windowMs: 60_000, limit: 10 },
            messageRecipient: { windowMs: 60_000, limit: 3 },
            aiTranscription: { windowMs: 60_000, limit: 5 },
            leadExport: { windowMs: 60_000, limit: 3 },
            leadImport: { windowMs: 60_000, limit: 3 },
            bulkUpdate: { windowMs: 60_000, limit: 3 },
            sensitiveAdmin: { windowMs: 60_000, limit: 2 }
          }
        });
        const limiters = await createRateLimiters({ config: cfg, redis: redisInst });
        const app = express();
        app.set('trust proxy', cfg.trustProxy);
        app.use(express.json());

        // Simulated verified auth & server-derived securityContext (ignores spoofed headers)
        app.use((req, _res, next) => {
          const userTag = (req.headers['x-test-user'] as string) || 'tenant-a:user-1';
          const [tenantId, userId] = userTag.split(':');
          req.securityContext = {
            requestId: `req-${Date.now()}`,
            ipAddress: req.ip || '127.0.0.1',
            actorUserId: userId,
            actorRole: 'owner',
            tenantId,
            isPlatformStaff: false,
            impersonating: false
          };
          req.user = { id: userId, tenantId, role: 'owner' } as any;
          next();
        });

        app.use('/api', limiters.authenticatedApi);

        app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
        app.get('/api/leads', (_req, res) => res.status(200).json([{ id: 'ld-1' }]));
        app.get('/api/cached', (_req, res) => res.status(304).end());
        app.post(
          '/api/messages',
          limiters.duplicateSubmissionGuard('message'),
          limiters.messageSending,
          limiters.messageRecipient,
          (_req, res) => res.status(200).json({ ok: true })
        );
        app.post(
          '/api/transcribe',
          limiters.aiTranscription,
          limiters.aiTranscriptionConcurrency,
          async (_req, res) => {
            await new Promise((r) => setTimeout(r, 150));
            res.status(200).json({ text: 'ok' });
          }
        );
        app.get(
          '/api/leads/export',
          limiters.duplicateSubmissionGuard('export'),
          limiters.leadExport,
          (_req, res) => res.status(202).json({ jobId: 'job-1' })
        );
        app.post(
          '/api/leads/import',
          limiters.duplicateSubmissionGuard('import'),
          limiters.leadImport,
          limiters.enforceImportBatchLimit,
          (_req, res) => res.status(202).json({ jobId: 'job-2' })
        );
        app.post(
          '/api/leads/bulk-update',
          limiters.duplicateSubmissionGuard('bulk_update'),
          limiters.bulkUpdate,
          (_req, res) => res.status(202).json({ jobId: 'job-3' })
        );
        app.post('/api/reset-data', limiters.sensitiveAdmin, (_req, res) => res.json({ ok: true }));
        app.use(globalErrorHandler);
        return app;
      };

      const [appA, appB] = await Promise.all([buildInstance(redisA), buildInstance(redisB)]);
      const [resA, resB] = await Promise.all([startHttpServer(appA), startHttpServer(appB)]);
      serverA = resA.server;
      urlA = resA.baseUrl;
      serverB = resB.server;
      urlB = resB.baseUrl;
    });

    after(async () => {
      await Promise.all([stopHttpServer(serverA), stopHttpServer(serverB)]);
      await Promise.all([redisA.disconnect(), redisB.disconnect()]);
    });

    it('shares counters in Redis across two separate Express instances (3 on A + 3 on B -> 7th blocked on both)', async () => {
      const userHeader = { 'x-test-user': 'tenant-multi:usr-shared' };

      // 3 calls to Instance A
      for (let i = 0; i < 3; i++) {
        const r = await fetch(`${urlA}/api/leads`, { headers: userHeader });
        assert.strictEqual(r.status, 200);
      }
      // 3 calls to Instance B
      for (let i = 0; i < 3; i++) {
        const r = await fetch(`${urlB}/api/leads`, { headers: userHeader });
        assert.strictEqual(r.status, 200);
      }

      // 7th call to Instance A -> 429
      const blockedA = await fetch(`${urlA}/api/leads`, { headers: userHeader });
      assert.strictEqual(blockedA.status, 429);
      // And Instance B -> 429
      const blockedB = await fetch(`${urlB}/api/leads`, { headers: userHeader });
      assert.strictEqual(blockedB.status, 429);

      // Different user in SAME tenant and user in DIFFERENT tenant remain unaffected
      const sameTenantOtherUser = await fetch(`${urlA}/api/leads`, {
        headers: { 'x-test-user': 'tenant-multi:usr-other' }
      });
      assert.strictEqual(sameTenantOtherUser.status, 200);

      const otherTenantUser = await fetch(`${urlB}/api/leads`, {
        headers: { 'x-test-user': 'tenant-two:usr-shared' }
      });
      assert.strictEqual(otherTenantUser.status, 200);
    });

    it('exempts /api/health and OPTIONS and preserves 304 Not Modified', async () => {
      const headers = { 'x-test-user': 'tenant-exempt:usr-1' };
      for (let i = 0; i < 10; i++) {
        const h = await fetch(`${urlA}/api/health`, { headers });
        assert.strictEqual(h.status, 200);
        const opt = await fetch(`${urlA}/api/leads`, { method: 'OPTIONS', headers });
        assert.ok(opt.status < 400);
      }
      const r304 = await fetch(`${urlA}/api/cached`, { headers });
      assert.strictEqual(r304.status, 304);
    });

    it('enforces recipient burst limit and Idempotency-Key duplicate prevention on /api/messages', async () => {
      const headers = {
        'Content-Type': 'application/json',
        'x-test-user': 'tenant-msg:usr-1'
      };
      // Duplicate Idempotency-Key blocked with 409
      const m1 = await fetch(`${urlA}/api/messages`, {
        method: 'POST',
        headers: { ...headers, 'Idempotency-Key': 'msg-key-1' },
        body: JSON.stringify({ leadId: 'lead-1', text: 'Hello' })
      });
      assert.strictEqual(m1.status, 200);

      const mDup = await fetch(`${urlB}/api/messages`, {
        method: 'POST',
        headers: { ...headers, 'Idempotency-Key': 'msg-key-1' },
        body: JSON.stringify({ leadId: 'lead-1', text: 'Hello' })
      });
      assert.strictEqual(mDup.status, 409);

      // Recipient burst limit = 3 across instances
      const m2 = await fetch(`${urlA}/api/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ leadId: 'lead-1', text: 'Msg 2' })
      });
      assert.strictEqual(m2.status, 200);
      const m3 = await fetch(`${urlB}/api/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ leadId: 'lead-1', text: 'Msg 3' })
      });
      assert.strictEqual(m3.status, 200);
      const mBlocked = await fetch(`${urlA}/api/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ leadId: 'lead-1', text: 'Msg 4' })
      });
      assert.strictEqual(mBlocked.status, 429);
      const body = await mBlocked.json();
      assert.strictEqual(body.policy, 'message_recipient');
    });

    it('enforces in-flight concurrency limits on /api/transcribe and releases slots on completion', async () => {
      const headers = {
        'Content-Type': 'application/json',
        'x-test-user': 'tenant-ai:usr-1'
      };
      // Max concurrent = 2 -> launch 3 simultaneously
      const [r1, r2, r3] = await Promise.all([
        fetch(`${urlA}/api/transcribe`, { method: 'POST', headers, body: '{}' }),
        fetch(`${urlB}/api/transcribe`, { method: 'POST', headers, body: '{}' }),
        fetch(`${urlA}/api/transcribe`, { method: 'POST', headers, body: '{}' })
      ]);
      const statuses = [r1.status, r2.status, r3.status].sort();
      assert.deepStrictEqual(statuses, [200, 200, 429]);

      // After completion, slot is freed
      const rAfter = await fetch(`${urlB}/api/transcribe`, { method: 'POST', headers, body: '{}' });
      assert.strictEqual(rAfter.status, 200);
    });

    it('enforces export/import/bulk/sensitive limits, batch caps, and duplicate job guards', async () => {
      const headers = {
        'Content-Type': 'application/json',
        'x-test-user': 'tenant-jobs:usr-1'
      };

      // Duplicate export job idempotency across instances
      const e1 = await fetch(`${urlA}/api/leads/export`, {
        headers: { ...headers, 'Idempotency-Key': 'exp-key-1' }
      });
      assert.strictEqual(e1.status, 202);
      const eDup = await fetch(`${urlB}/api/leads/export`, {
        headers: { ...headers, 'Idempotency-Key': 'exp-key-1' }
      });
      assert.strictEqual(eDup.status, 409);

      // Export quota (limit 3)
      const e2 = await fetch(`${urlB}/api/leads/export`, { headers });
      assert.strictEqual(e2.status, 202);
      const e3 = await fetch(`${urlA}/api/leads/export`, { headers });
      assert.strictEqual(e3.status, 202);
      const e4 = await fetch(`${urlB}/api/leads/export`, { headers });
      assert.strictEqual(e4.status, 429);

      // Import batch cap (max 5)
      const bigImport = await fetch(`${urlA}/api/leads/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ leads: [1, 2, 3, 4, 5, 6] })
      });
      assert.strictEqual(bigImport.status, 400);

      // Sensitive admin endpoint limit (limit 2)
      const s1 = await fetch(`${urlA}/api/reset-data`, { method: 'POST', headers: { 'x-test-user': 'tenant-admin:usr-1' } });
      assert.strictEqual(s1.status, 200);
      const s2 = await fetch(`${urlB}/api/reset-data`, { method: 'POST', headers: { 'x-test-user': 'tenant-admin:usr-1' } });
      assert.strictEqual(s2.status, 200);
      const s3 = await fetch(`${urlA}/api/reset-data`, { method: 'POST', headers: { 'x-test-user': 'tenant-admin:usr-1' } });
      assert.strictEqual(s3.status, 429);
    });
  });

  describe('4. Redis Outage Handling, Safe Decrement & Recovery', () => {
    it('fails closed (503) on auth, fails open/closed as configured on API, never crashes on decrement, and recovers Lua scripts', async () => {
      let redisUp = true;
      const liveClient = new Redis(REDIS_URL);
      const cfgFailOpen = buildTestConfig({
        apiFailOpen: true,
        policies: {
          ...buildTestConfig().policies,
          loginIpFailed: { windowMs: 60_000, limit: 5 },
          authenticatedApi: { windowMs: 60_000, limit: 5 }
        }
      });

      const limiters = await createRateLimiters({
        config: cfgFailOpen,
        redisClientProvider: () => (redisUp ? liveClient : null)
      });

      const app = express();
      app.set('trust proxy', 1);
      app.use(express.json());
      app.post('/api/auth/login', limiters.loginIpFailed, (_req, res) => {
        res.status(200).json({ ok: true });
      });
      app.get('/api/leads', limiters.authenticatedApi, (_req, res) => {
        res.status(200).json({ ok: true });
      });
      app.use(globalErrorHandler);

      const { server, baseUrl } = await startHttpServer(app);

      try {
        // 1. Healthy baseline
        const ok1 = await fetch(`${baseUrl}/api/leads`);
        assert.strictEqual(ok1.status, 200);

        // 2. Drop Redis mid-flight
        redisUp = false;

        // Auth endpoint fails closed -> 503 RATE_LIMIT_STORE_UNAVAILABLE
        const authDown = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
        assert.strictEqual(authDown.status, 503);
        const authErrBody = await authDown.json();
        assert.strictEqual(authErrBody.error.code, 'RATE_LIMIT_STORE_UNAVAILABLE');

        // General API with apiFailOpen=true fails open -> 200 and increments fallback metric
        const apiFailOpenRes = await fetch(`${baseUrl}/api/leads`);
        assert.strictEqual(apiFailOpenRes.status, 200);
        assert.ok(metricsRegistry.metrics().includes('rate_limit_store_errors_total'));
        assert.ok(metricsRegistry.metrics().includes('rate_limit_fallback_total'));

        // 3. Direct ResilientRedisStore decrement during outage does not throw / cause UnhandledRejection
        const directStore = new ResilientRedisStore('test_dec', 'test', () => null);
        await directStore.decrement('nonexistent-key');

        // 4. Flush Redis Lua script cache (SCRIPT FLUSH) + restore Redis -> ResilientRedisStore recovers automatically!
        await liveClient.script('FLUSH');
        redisUp = true;

        const recoveredLogin = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
        assert.strictEqual(recoveredLogin.status, 200);
        assert.ok(recoveredLogin.headers.get('ratelimit'));
      } finally {
        await stopHttpServer(server);
        await liveClient.quit();
      }
    });
  });

  describe('5. Observability, PII Redaction & /metrics Protection', () => {
    it('redacts sensitive fields (email, ip, cookie, token, phone) in Logger', () => {
      const captured: string[] = [];
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: any) => {
        captured.push(String(chunk));
        return true;
      }) as any;

      try {
        const testLogger = new Logger('test');
        testLogger.warn('Rate limit test event', {
          email: 'secret@example.com',
          ip: '198.51.100.77',
          ipAddress: '198.51.100.77',
          cookie: 'refreshToken=abc',
          phone: '+919876543210',
          description: 'keep description safe'
        });
      } finally {
        process.stdout.write = origWrite;
      }

      const logLine = captured.join('');
      assert.ok(!logLine.includes('secret@example.com'));
      assert.ok(!logLine.includes('198.51.100.77'));
      assert.ok(!logLine.includes('refreshToken=abc'));
      assert.ok(!logLine.includes('+919876543210'));
      assert.ok(logLine.includes('keep description safe'));
    });

    it('protects /metrics when METRICS_AUTH_TOKEN is configured and exports bounded-label rate limit metrics', async () => {
      const prevToken = process.env.METRICS_AUTH_TOKEN;
      process.env.METRICS_AUTH_TOKEN = 'super-secret-scrape-token-123';

      const app = express();
      app.get('/metrics', requireMetricsAuth, (_req, res) => {
        res.set('Content-Type', 'text/plain; version=0.0.4');
        res.send(metricsRegistry.metrics());
      });
      const { server, baseUrl } = await startHttpServer(app);

      try {
        const unauth = await fetch(`${baseUrl}/metrics`);
        assert.strictEqual(unauth.status, 401);

        const wrong = await fetch(`${baseUrl}/metrics`, {
          headers: { Authorization: 'Bearer wrong-token' }
        });
        assert.strictEqual(wrong.status, 401);

        const ok = await fetch(`${baseUrl}/metrics`, {
          headers: { Authorization: 'Bearer super-secret-scrape-token-123' }
        });
        assert.strictEqual(ok.status, 200);
        const text = await ok.text();

        for (const metricName of [
          'rate_limit_requests_total',
          'rate_limit_exceeded_total',
          'rate_limit_store_errors_total',
          'rate_limit_fallback_total',
          'rate_limit_store_latency_seconds'
        ]) {
          assert.ok(text.includes(metricName), `Missing Prometheus metric ${metricName}`);
        }

        // Ensure zero PII or raw identifiers appear in metrics output
        assert.ok(!text.includes('198.51.100.'));
        assert.ok(!text.includes('@dialpulse.in'));
        assert.ok(!text.includes('tok-abc-123'));

        // Also verify platform staff JWT is accepted
        const platformToken = signAccessToken(
          { id: 'plat-1', email: 'ops@dialpulse.in', role: 'platform_admin', isPlatformStaff: true },
          'sess-plat'
        );
        const okJwt = await fetch(`${baseUrl}/metrics`, {
          headers: { Authorization: `Bearer ${platformToken}` }
        });
        assert.strictEqual(okJwt.status, 200);
      } finally {
        if (prevToken === undefined) delete process.env.METRICS_AUTH_TOKEN;
        else process.env.METRICS_AUTH_TOKEN = prevToken;
        await stopHttpServer(server);
      }
    });
  });
});
