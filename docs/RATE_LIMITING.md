# DialPulse Client CRM — Distributed API Rate Limiting Architecture

This document describes the production-grade API rate-limiting architecture implemented in `server/middleware/rateLimits.ts`, `server/infrastructure/redis.ts`, and `server.ts`.

---

## 1. Architecture & Strategy

- **Stack**: `express-rate-limit` (`^8.7.0`) + `rate-limit-redis` (`^6.0.1`) + `ioredis` (`^6.0.0`).
- **Algorithm**: Redis-backed **fixed-window counters** (`ResilientRedisStore` wrapping `RedisStore`) across all application instances.
  - **Fixed-window trade-off**: Fixed windows provide atomic, low-overhead shared counting across instances via Redis Lua `EVALSHA` scripts (`INCR` + `PTTL`/`PX`). Around exact window boundaries, a caller may send up to `2x` the limit across the boundary second; limits are sized conservatively (with independent request + failed-attempt layers on login and concurrency caps on AI) to keep boundary bursts safe without the extra memory/sorted-set overhead of sliding logs.
- **Standard Headers**: All limiters emit IETF `RateLimit` / `RateLimit-Policy` (`standardHeaders: 'draft-8'`), `Retry-After` on `429`, and disable legacy `X-RateLimit-*` headers (`legacyHeaders: false`).
- **Startup Synchronization**: `server.ts` explicitly awaits `redisService.ensureReady()` inside `createRateLimiters()` before instantiating stores so `lazyConnect: true` never causes a silent race fallback to `MemoryStore`.

---

## 2. Policy Matrix

| Policy (`identifier`) | Scope / Endpoints | Window | Default Limit | Identity Key | Store Failure Behavior |
|---|---|---:|---:|---|---|
| `login_ip_request` | `POST /api/auth/login` | 15m | 120 | HMAC(IP / IPv6 `/56`) | Fail-closed (`503`) |
| `login_ip_failed` | `POST /api/auth/login` (`401` only) | 15m | 30 | HMAC(IP / IPv6 `/56`) | Fail-closed (`503`) |
| `login_account_failed` | `POST /api/auth/login` (`401` only) | 15m | 8 | HMAC(NFKC email) | Fail-closed (`503`) |
| `session_refresh` | `POST /api/auth/refresh` | 5m | 30 | HMAC(refreshToken + IP `/56`) | Fail-closed (`503`) |
| `authenticated_api` | `/api/*` (post-auth, skips `/api/health`, `/api/auth/login`, `/api/auth/refresh`, `OPTIONS`) | 1m | 300 | HMAC(`tenantId` + `userId`, fallback IP) | Configurable (`RATE_LIMIT_API_FAIL_OPEN`, default `true`) |
| `message_sending` | `POST /api/messages` | 1m | 30 | HMAC(`tenantId` + `userId`) | Fail-closed (`503`) |
| `message_recipient` | `POST /api/messages` | 5m | 10 | HMAC(`tenantId` + `leadId`) | Fail-closed (`503`) |
| `ai_transcription` | `POST /api/transcribe` | 1m | 10 | HMAC(`tenantId` + `userId`) | Fail-closed (`503`) |
| `ai_transcription_concurrency` | `POST /api/transcribe` (in-flight) | Active | 3 | HMAC(`tenantId` + `userId`) | Fail-closed (`503`) |
| `lead_export` | `GET /api/leads/export` | 15m | 3 | HMAC(`tenantId` + `userId`) | Fail-closed (`503`) |
| `lead_import` | `POST /api/leads/import` (+ max 200 rows/req) | 15m | 5 | HMAC(`tenantId` + `userId`) | Fail-closed (`503`) |
| `bulk_update` | `POST /api/leads/bulk-update` | 5m | 10 | HMAC(`tenantId` + `userId`) | Fail-closed (`503`) |
| `sensitive_admin` | `POST /api/auth/switch-user`, `DELETE /api/auth/sessions/:id`, `POST /api/platform/impersonate`, `POST /api/reset-data`, `POST /api/backups/:id/restore` | 15m | 15 | HMAC(`tenantId` + `userId`) | Fail-closed (`503`) |

Additionally, `POST /api/messages`, `GET /api/leads/export`, `POST /api/leads/import`, and `POST /api/leads/bulk-update` enforce distributed `Idempotency-Key` / `X-Idempotency-Key` deduplication (`409 DUPLICATE_SUBMISSION` / `409 DUPLICATE_JOB_SUBMISSION`).

---

## 3. Client Identification & Proxy Topology

- **Trusted IP Extraction**: Express uses `TRUST_PROXY` (default `1` for one reverse proxy hop such as Cloud Run or Nginx). `TRUST_PROXY=true` or `*` is explicitly rejected at startup to prevent arbitrary `X-Forwarded-For` spoofing. All internal callers use `getTrustedClientIp(req)` (`req.ip`), never raw `req.headers['x-forwarded-for']`.
- **IPv6 Normalization**: IPv6 addresses are normalized via `ipKeyGenerator(ip, subnet)` (default `/56`, configurable via `RATE_LIMIT_IPV6_SUBNET`).
- **Key Privacy**: All sensitive identifiers (emails, IPs, refresh tokens, user IDs, lead IDs) are hashed using HMAC-SHA256 keyed with `RATE_LIMIT_KEY_SECRET` (mandatory `>= 32` characters in production).
- **Email Normalization**: Login emails undergo `trim()`, Unicode `NFKC` normalization, lowercasing, and format validation before keying; malformed/missing emails bypass account-level counting while still remaining subject to IP limits.
- **Tenant Isolation**: Authenticated policies strictly use server-derived `req.securityContext.tenantId` and `actorUserId`, ignoring client-supplied headers or body fields.

---

## 4. Failure Handling & Development vs. Production

- **Production (`NODE_ENV=production`)**:
  - `RATE_LIMIT_STORE` defaults to `redis`.
  - `RATE_LIMIT_REQUIRE_REDIS` defaults to `true`. If Redis is unreachable at boot, startup aborts cleanly rather than silently running with per-instance `MemoryStore`.
  - `/health/ready` returns `503` if Redis is unavailable while `RATE_LIMIT_REQUIRE_REDIS=true`.
  - Store outages mid-flight fail closed (`503 RATE_LIMIT_STORE_UNAVAILABLE` with `Retry-After`) on authentication, refresh, messaging, AI, export, import, bulk, and admin routes. General `authenticated_api` traffic respects `RATE_LIMIT_API_FAIL_OPEN` (`true` by default, emitting `rate_limit_fallback_total` and high-severity alerts).
  - `ResilientRedisStore` resets cached Lua script SHAs on disconnect/`NOSCRIPT` and catches post-response `decrement()` errors so Redis outages never cause unhandled promise rejections.
- **Development (`NODE_ENV=development`)**:
  - Uses Redis automatically when `REDIS_URL` is configured and reachable; if `RATE_LIMIT_REQUIRE_REDIS=false` and Redis is unreachable at boot, logs an explicit warning, increments `rate_limit_fallback_total`, and uses `MemoryStore`.

---

## 5. Observability, Metrics Protection & 429 Investigation

### Prometheus Metrics (`/metrics` and `/health/metrics`)
- Protected by `requireMetricsAuth`: requires `Authorization: Bearer <METRICS_AUTH_TOKEN>` or a platform staff JWT when `METRICS_AUTH_TOKEN` is configured or when `NODE_ENV=production`.
- Exported metrics (all strictly bounded labels — no raw IP, email, token, userId, or tenantId):
  - `rate_limit_requests_total{policy,route_category,status_class,environment}`
  - `rate_limit_exceeded_total{policy,route_category,environment}`
  - `rate_limit_store_errors_total{policy,operation,environment}`
  - `rate_limit_fallback_total{policy,reason,environment}`
  - `rate_limit_store_latency_seconds{policy,operation,environment}`

### Investigating 429 Spikes & Tuning
1. Query `rate_limit_exceeded_total` by `policy` and `route_category` to identify whether blocks come from auth brute-force (`login_*`), scraping (`authenticated_api`), or high-cost routes (`ai_transcription`, `lead_export`).
2. Check structured logs for `[RATE_LIMIT] Request blocked` correlated via `requestId`, `policy`, and redacted `keyPrefix` (first 32 chars of the HMAC key).
3. If legitimate corporate NAT users hit `login_ip_request` or `authenticated_api`, confirm `TRUST_PROXY` hop count matches your ingress/load-balancer topology before increasing `RATE_LIMIT_LOGIN_IP_REQ_LIMIT` or `RATE_LIMIT_API_LIMIT`.
4. If `rate_limit_store_errors_total` or `rate_limit_fallback_total` rises, verify Redis connectivity/latency via `rate_limit_store_latency_seconds` and `/health/ready`.

---

## 6. Testing Rate Limiting

- **Unit & Integration Security Suite**: `npm run test:security`
- **Distributed, Multi-Instance & Outage Suite**: `npx tsx tests/rate-limiting-comprehensive.test.ts`
- **Redis Infrastructure Check**: `npx tsx security-tests/redis-infrastructure.test.ts`
