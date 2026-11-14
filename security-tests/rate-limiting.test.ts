// security-tests/rate-limiting.test.ts
// Category 6: Rate Limiting, IP Spoofing & Abuse Prevention Tests

import { request, getAuthToken, TestResult } from './helpers';

export async function runRateLimitingTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const adminToken = await getAuthToken('admin');

  // --------------------------------------------------------------------------
  // TEST 6.1: Rate Limiter Bypass via Spoofed X-Forwarded-For Header
  // --------------------------------------------------------------------------
  {
    const start = Date.now();
    try {
      const fixedIp = '198.51.100.50';

      for (let i = 0; i < 32; i++) {
        await request('/api/auth/login', {
          method: 'POST',
          headers: { 'X-Forwarded-For': fixedIp },
          body: { email: 'wrong@telecrm.in', password: 'wrong' }
        });
      }

      const blockedRes = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'X-Forwarded-For': fixedIp },
        body: { email: 'wrong@telecrm.in', password: 'wrong' }
      });

      const isRateLimited = blockedRes.status === 429;
      const hasDraft8 = Boolean(
        blockedRes.headers.get('ratelimit') &&
        blockedRes.headers.get('ratelimit-policy') &&
        blockedRes.headers.get('retry-after')
      );

      // Rotating XFF must not bypass account limiter; prepended spoofed hop must not bypass rightmost trusted hop
      const spoofedIp = '198.51.100.51';
      const spoofRes = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'X-Forwarded-For': spoofedIp },
        body: { email: 'wrong@telecrm.in', password: 'wrong' }
      });

      const multiHopRes = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'X-Forwarded-For': `203.0.113.250, ${fixedIp}` },
        body: { email: `spray-${Date.now()}@telecrm.in`, password: 'wrong' }
      });

      const bypassSuccessful = (isRateLimited && spoofRes.status === 401) || multiHopRes.status === 401;

      results.push({
        category: 'Rate Limiting & Abuse',
        name: 'Rate Limiter Spoofing Resistance (X-Forwarded-For Bypass)',
        passed: !bypassSuccessful && hasDraft8,
        severity: 'High',
        details: bypassSuccessful
          ? 'VULNERABILITY CONFIRMED: Rotating or prepending X-Forwarded-For bypassed rate limiting quotas.'
          : !hasDraft8
            ? 'WARNING: Missing Draft-8 RateLimit / RateLimit-Policy / Retry-After headers on 429 response.'
            : 'Protected: Account limiter, rightmost trusted proxy hop resolution, and Draft-8 headers enforced.',
        executionTimeMs: Date.now() - start
      });
    } catch (e: any) {
      results.push({
        category: 'Rate Limiting & Abuse',
        name: 'Rate Limiter Spoofing Resistance (X-Forwarded-For Bypass)',
        passed: false,
        severity: 'High',
        details: `Test execution failed: ${e.message}`,
        executionTimeMs: Date.now() - start
      });
    }
  }

  // --------------------------------------------------------------------------
  // TEST 6.2: Expensive Resource Abuse / Large Batch Input Handling
  // --------------------------------------------------------------------------
  {
    const start = Date.now();
    try {
      const oversizedBatch = Array.from({ length: 500 }, (_, i) => ({
        name: `Oversized Lead ${i}`,
        phone: `+9198112345${String(i).padStart(2, '0')}`,
        notes: 'X'.repeat(500)
      }));

      const res = await request('/api/leads/import', {
        method: 'POST',
        token: adminToken,
        body: { leads: oversizedBatch }
      });

      const isUnbounded = res.status === 200 && res.data?.count === 500;

      results.push({
        category: 'Rate Limiting & Abuse',
        name: 'Unbounded Batch Processing Limit (/api/leads/import)',
        passed: !isUnbounded && res.status === 400,
        severity: 'Medium',
        details: isUnbounded
          ? 'WARNING: /api/leads/import accepted 500 records without batch-size restrictions.'
          : `Enforced: Batch import exceeding cap rejected with HTTP ${res.status} (${res.data?.code || 'OK'}).`,
        executionTimeMs: Date.now() - start
      });
    } catch (e: any) {
      results.push({
        category: 'Rate Limiting & Abuse',
        name: 'Unbounded Batch Processing Limit (/api/leads/import)',
        passed: false,
        severity: 'Medium',
        details: `Test execution failed: ${e.message}`,
        executionTimeMs: Date.now() - start
      });
    }
  }

  // --------------------------------------------------------------------------
  // TEST 6.3: Authenticated Endpoint Draft-8 Headers & Export Rate Limiting
  // --------------------------------------------------------------------------
  {
    const start = Date.now();
    try {
      const healthRes = await request('/api/leads', { token: adminToken });
      const hasStandardHeaders = Boolean(
        healthRes.headers.get('ratelimit') &&
        healthRes.headers.get('ratelimit-policy')
      );
      const hasLegacyHeaders = Boolean(
        healthRes.headers.get('x-ratelimit-limit') ||
        healthRes.headers.get('x-ratelimit-remaining')
      );

      results.push({
        category: 'Rate Limiting & Abuse',
        name: 'Draft-8 Standard Headers on Authenticated API (legacyHeaders disabled)',
        passed: healthRes.status === 200 && hasStandardHeaders && !hasLegacyHeaders,
        severity: 'Low',
        details: hasStandardHeaders && !hasLegacyHeaders
          ? 'Protected: Authenticated API emits Draft-8 RateLimit/RateLimit-Policy headers with legacy headers disabled.'
          : `Header mismatch (status=${healthRes.status}, standard=${hasStandardHeaders}, legacy=${hasLegacyHeaders}).`,
        executionTimeMs: Date.now() - start
      });
    } catch (e: any) {
      results.push({
        category: 'Rate Limiting & Abuse',
        name: 'Draft-8 Standard Headers on Authenticated API (legacyHeaders disabled)',
        passed: false,
        severity: 'Low',
        details: `Test execution failed: ${e.message}`,
        executionTimeMs: Date.now() - start
      });
    }
  }

  return results;
}

