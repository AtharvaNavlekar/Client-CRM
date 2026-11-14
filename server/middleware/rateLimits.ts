import express, { NextFunction, Request, RequestHandler, Response } from 'express';
import crypto from 'crypto';
import rateLimit, {
  ClientRateLimitInfo,
  IncrementResponse,
  ipKeyGenerator,
  MemoryStore,
  Options,
  RateLimitRequestHandler,
  Store
} from 'express-rate-limit';
import { RedisReply, RedisStore } from 'rate-limit-redis';
import type { Redis } from 'ioredis';
import { createHmacSafeKey, redisService, RedisService } from '../infrastructure/redis';
import { logger } from '../infrastructure/logger';
import { emitRateLimitAlert } from '../infrastructure/alerts';
import {
  rateLimitExceededTotal,
  rateLimitFallbackTotal,
  rateLimitRequestsTotal,
  rateLimitStoreErrorsTotal,
  rateLimitStoreLatencySeconds
} from '../infrastructure/metrics';
import { AppError } from './errorHandler';

export type RateLimitStoreMode = 'redis' | 'memory';
export type RouteCategory =
  | 'auth'
  | 'session'
  | 'api'
  | 'messaging'
  | 'ai'
  | 'export'
  | 'import'
  | 'bulk'
  | 'admin';

export interface PolicyWindowLimit {
  windowMs: number;
  limit: number;
}

export interface RateLimitConfig {
  environment: string;
  storeMode: RateLimitStoreMode;
  requireRedis: boolean;
  apiFailOpen: boolean;
  trustProxy: number | string | false;
  ipv6Subnet: 32 | 48 | 50 | 52 | 56 | 60 | 64;
  keySecret: string;
  importMaxBatchSize: number;
  transcribeMaxConcurrent: number;
  idempotencyTtlSeconds: number;
  jobDedupTtlSeconds: number;
  policies: {
    loginIpRequest: PolicyWindowLimit;
    loginIpFailed: PolicyWindowLimit;
    loginAccountFailed: PolicyWindowLimit;
    sessionRefresh: PolicyWindowLimit;
    authenticatedApi: PolicyWindowLimit;
    messageSending: PolicyWindowLimit;
    messageRecipient: PolicyWindowLimit;
    aiTranscription: PolicyWindowLimit;
    leadExport: PolicyWindowLimit;
    leadImport: PolicyWindowLimit;
    bulkUpdate: PolicyWindowLimit;
    sensitiveAdmin: PolicyWindowLimit;
  };
}

const VALID_IPV6_SUBNETS = new Set([32, 48, 50, 52, 56, 60, 64]);

let ephemeralDevSecret: string | null = null;
function getOrCreateEphemeralDevSecret(): string {
  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralDevSecret;
}

function parseBoolEnv(raw: string | undefined, defaultValue: boolean, name: string): boolean {
  if (raw === undefined || raw.trim() === '') return defaultValue;
  const val = raw.trim().toLowerCase();
  if (val === 'true' || val === '1' || val === 'yes') return true;
  if (val === 'false' || val === '0' || val === 'no') return false;
  throw new Error(`Invalid boolean configuration for ${name}: "${raw}". Expected "true" or "false".`);
}

function parseIntEnv(
  raw: string | undefined,
  defaultValue: number,
  name: string,
  min = 1,
  max = 86_400_000
): number {
  if (raw === undefined || raw.trim() === '') return defaultValue;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `Invalid integer configuration for ${name}: "${raw}". Expected integer between ${min} and ${max}.`
    );
  }
  return parsed;
}

export function parseTrustProxyConfig(raw: string | undefined): number | string | false {
  if (raw === undefined || raw.trim() === '') return 1;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'true' || lower === 'all' || trimmed === '*') {
    throw new Error(
      'Invalid TRUST_PROXY configuration: "true" / wildcard proxy trust is forbidden because it permits X-Forwarded-For spoofing. Specify an exact hop count (e.g. "1"), "loopback", or trusted CIDR/IP.'
    );
  }
  if (lower === 'false' || trimmed === '0') {
    return false;
  }
  if (/^\d+$/.test(trimmed)) {
    const hops = parseInt(trimmed, 10);
    if (hops < 0 || hops > 10) {
      throw new Error(`Invalid TRUST_PROXY hop count "${trimmed}". Expected 0..10.`);
    }
    return hops === 0 ? false : hops;
  }
  if (['loopback', 'linklocal', 'uniquelocal'].includes(lower)) {
    return lower;
  }
  // Allow explicit comma-separated IPs/CIDRs
  return trimmed;
}

export function loadRateLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<RateLimitConfig> = {}
): RateLimitConfig {
  const environment = (env.NODE_ENV || 'development').trim() || 'development';
  const isProd = environment === 'production';

  const hasRedisUrl = Boolean(env.REDIS_URL && env.REDIS_URL.trim().length > 0);
  const rawStore = env.RATE_LIMIT_STORE?.trim().toLowerCase();
  let storeMode: RateLimitStoreMode;
  if (rawStore === undefined || rawStore === '') {
    storeMode = isProd || hasRedisUrl ? 'redis' : 'memory';
  } else if (rawStore === 'redis' || rawStore === 'memory') {
    storeMode = rawStore;
  } else {
    throw new Error(`Invalid RATE_LIMIT_STORE: "${rawStore}". Expected "redis" or "memory".`);
  }

  const requireRedis =
    overrides.requireRedis ??
    parseBoolEnv(env.RATE_LIMIT_REQUIRE_REDIS, isProd, 'RATE_LIMIT_REQUIRE_REDIS');

  const finalStoreMode = overrides.storeMode ?? storeMode;
  if (requireRedis && finalStoreMode !== 'redis') {
    throw new Error(
      'Invalid rate-limit configuration: RATE_LIMIT_REQUIRE_REDIS=true cannot be combined with RATE_LIMIT_STORE=memory.'
    );
  }

  const apiFailOpen =
    overrides.apiFailOpen ??
    parseBoolEnv(env.RATE_LIMIT_API_FAIL_OPEN, true, 'RATE_LIMIT_API_FAIL_OPEN');

  const trustProxy =
    overrides.trustProxy !== undefined
      ? overrides.trustProxy
      : parseTrustProxyConfig(env.TRUST_PROXY);

  const rawSubnet = parseIntEnv(env.RATE_LIMIT_IPV6_SUBNET, 56, 'RATE_LIMIT_IPV6_SUBNET', 32, 64);
  if (!VALID_IPV6_SUBNETS.has(rawSubnet)) {
    throw new Error(
      `Invalid RATE_LIMIT_IPV6_SUBNET: ${rawSubnet}. Supported values: 32, 48, 50, 52, 56, 60, 64.`
    );
  }

  let keySecret = overrides.keySecret ?? env.RATE_LIMIT_KEY_SECRET?.trim();
  if (isProd) {
    if (!keySecret || keySecret.length < 32) {
      throw new Error(
        'FATAL: RATE_LIMIT_KEY_SECRET must be set to at least 32 characters in production.'
      );
    }
  } else if (!keySecret) {
    logger.warn(
      '[RATE_LIMIT] RATE_LIMIT_KEY_SECRET is not set; using ephemeral per-process dev key. Set RATE_LIMIT_KEY_SECRET in .env for cross-process consistency.'
    );
    keySecret = getOrCreateEphemeralDevSecret();
  } else if (keySecret.length < 16) {
    throw new Error('Invalid RATE_LIMIT_KEY_SECRET: must be at least 16 characters.');
  }

  const basePolicies: RateLimitConfig['policies'] = {
    loginIpRequest: {
      windowMs: parseIntEnv(env.RATE_LIMIT_LOGIN_IP_REQ_WINDOW_MS, 15 * 60 * 1000, 'RATE_LIMIT_LOGIN_IP_REQ_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_LOGIN_IP_REQ_LIMIT, 120, 'RATE_LIMIT_LOGIN_IP_REQ_LIMIT')
    },
    loginIpFailed: {
      windowMs: parseIntEnv(env.RATE_LIMIT_LOGIN_IP_FAIL_WINDOW_MS, 15 * 60 * 1000, 'RATE_LIMIT_LOGIN_IP_FAIL_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_LOGIN_IP_FAIL_LIMIT, 30, 'RATE_LIMIT_LOGIN_IP_FAIL_LIMIT')
    },
    loginAccountFailed: {
      windowMs: parseIntEnv(env.RATE_LIMIT_LOGIN_ACCOUNT_FAIL_WINDOW_MS, 15 * 60 * 1000, 'RATE_LIMIT_LOGIN_ACCOUNT_FAIL_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_LOGIN_ACCOUNT_FAIL_LIMIT, 8, 'RATE_LIMIT_LOGIN_ACCOUNT_FAIL_LIMIT')
    },
    sessionRefresh: {
      windowMs: parseIntEnv(env.RATE_LIMIT_REFRESH_WINDOW_MS, 5 * 60 * 1000, 'RATE_LIMIT_REFRESH_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_REFRESH_LIMIT, 30, 'RATE_LIMIT_REFRESH_LIMIT')
    },
    authenticatedApi: {
      windowMs: parseIntEnv(env.RATE_LIMIT_API_WINDOW_MS, 60 * 1000, 'RATE_LIMIT_API_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_API_LIMIT, 300, 'RATE_LIMIT_API_LIMIT')
    },
    messageSending: {
      windowMs: parseIntEnv(env.RATE_LIMIT_MESSAGES_WINDOW_MS, 60 * 1000, 'RATE_LIMIT_MESSAGES_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_MESSAGES_LIMIT, 30, 'RATE_LIMIT_MESSAGES_LIMIT')
    },
    messageRecipient: {
      windowMs: parseIntEnv(env.RATE_LIMIT_MESSAGES_RECIPIENT_WINDOW_MS, 5 * 60 * 1000, 'RATE_LIMIT_MESSAGES_RECIPIENT_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_MESSAGES_RECIPIENT_LIMIT, 10, 'RATE_LIMIT_MESSAGES_RECIPIENT_LIMIT')
    },
    aiTranscription: {
      windowMs: parseIntEnv(env.RATE_LIMIT_TRANSCRIBE_WINDOW_MS, 60 * 1000, 'RATE_LIMIT_TRANSCRIBE_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_TRANSCRIBE_LIMIT, 10, 'RATE_LIMIT_TRANSCRIBE_LIMIT')
    },
    leadExport: {
      windowMs: parseIntEnv(env.RATE_LIMIT_EXPORT_WINDOW_MS, 15 * 60 * 1000, 'RATE_LIMIT_EXPORT_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_EXPORT_LIMIT, 3, 'RATE_LIMIT_EXPORT_LIMIT')
    },
    leadImport: {
      windowMs: parseIntEnv(env.RATE_LIMIT_IMPORT_WINDOW_MS, 15 * 60 * 1000, 'RATE_LIMIT_IMPORT_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_IMPORT_LIMIT, 5, 'RATE_LIMIT_IMPORT_LIMIT')
    },
    bulkUpdate: {
      windowMs: parseIntEnv(env.RATE_LIMIT_BULK_UPDATE_WINDOW_MS, 5 * 60 * 1000, 'RATE_LIMIT_BULK_UPDATE_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_BULK_UPDATE_LIMIT, 10, 'RATE_LIMIT_BULK_UPDATE_LIMIT')
    },
    sensitiveAdmin: {
      windowMs: parseIntEnv(env.RATE_LIMIT_SENSITIVE_WINDOW_MS, 15 * 60 * 1000, 'RATE_LIMIT_SENSITIVE_WINDOW_MS'),
      limit: parseIntEnv(env.RATE_LIMIT_SENSITIVE_LIMIT, 15, 'RATE_LIMIT_SENSITIVE_LIMIT')
    }
  };

  return {
    environment,
    storeMode: finalStoreMode,
    requireRedis,
    apiFailOpen,
    trustProxy,
    ipv6Subnet: (overrides.ipv6Subnet ?? rawSubnet) as RateLimitConfig['ipv6Subnet'],
    keySecret,
    importMaxBatchSize:
      overrides.importMaxBatchSize ??
      parseIntEnv(env.RATE_LIMIT_IMPORT_MAX_BATCH, 200, 'RATE_LIMIT_IMPORT_MAX_BATCH', 1, 10_000),
    transcribeMaxConcurrent:
      overrides.transcribeMaxConcurrent ??
      parseIntEnv(env.RATE_LIMIT_TRANSCRIBE_MAX_CONCURRENT, 3, 'RATE_LIMIT_TRANSCRIBE_MAX_CONCURRENT', 1, 100),
    idempotencyTtlSeconds:
      overrides.idempotencyTtlSeconds ??
      parseIntEnv(env.RATE_LIMIT_MESSAGE_IDEMPOTENCY_TTL_SEC, 30, 'RATE_LIMIT_MESSAGE_IDEMPOTENCY_TTL_SEC', 1, 3600),
    jobDedupTtlSeconds:
      overrides.jobDedupTtlSeconds ??
      parseIntEnv(env.RATE_LIMIT_JOB_DEDUP_TTL_SEC, 60, 'RATE_LIMIT_JOB_DEDUP_TTL_SEC', 1, 3600),
    policies: overrides.policies ? { ...basePolicies, ...overrides.policies } : basePolicies
  };
}

/**
 * Normalizes and validates email addresses before HMAC hashing.
 * Returns null if missing, malformed, or oversized.
 */
export function normalizeEmailForRateLimit(rawEmail: unknown): string | null {
  if (typeof rawEmail !== 'string') return null;
  const trimmed = rawEmail.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return null;
  const normalized = trimmed.normalize('NFKC').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

/**
 * Extracts Express-resolved client IP (respecting configured `trust proxy`)
 * without directly trusting raw spoofable X-Forwarded-For headers.
 */
export function getTrustedClientIp(req: Request): string {
  const candidate = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  // Strip optional port suffix if malformed IPv4:port occurs from custom transports
  return candidate.replace(/^::ffff:/, '');
}

function parseCookiesHeader(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  for (const segment of cookieHeader.split(';')) {
    const idx = segment.indexOf('=');
    if (idx === -1) continue;
    const key = segment.slice(0, idx).trim();
    const val = segment.slice(idx + 1).trim();
    if (key) {
      try {
        list[key] = decodeURIComponent(val);
      } catch {
        list[key] = val;
      }
    }
  }
  return list;
}

function observeStoreDuration(policy: string, operation: string, environment: string, startNs: bigint) {
  const elapsedSeconds = Number(process.hrtime.bigint() - startNs) / 1_000_000_000;
  rateLimitStoreLatencySeconds.observe({ policy, operation, environment }, elapsedSeconds);
}

/**
 * Resilient Redis Store wrapping `rate-limit-redis` v6.
 * Fixes:
 *  - Rejected SHA promise caching if init() ran while disconnected
 *  - Script reload after Redis restart (NOSCRIPT or connection loss)
 *  - Never returns null (throws AppError 503 RATE_LIMIT_STORE_UNAVAILABLE)
 *  - Safe error-catching decrement() to prevent post-response UnhandledPromiseRejection
 *  - Prometheus latency and store error metrics
 */
export class ResilientRedisStore implements Store {
  public readonly prefix: string;
  public readonly localKeys = false;
  private readonly inner: RedisStore;
  private windowMs = 60_000;
  private scriptsLoaded = false;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly policyName: string,
    private readonly environment: string,
    private readonly getClient: () => Redis | null
  ) {
    this.prefix = `dp:rl:${policyName}:`;
    this.inner = new RedisStore({
      prefix: this.prefix,
      sendCommand: async (...args: string[]): Promise<RedisReply> => {
        const client = this.getClient();
        if (!client || client.status !== 'ready') {
          throw new AppError(
            'RATE_LIMIT_STORE_UNAVAILABLE',
            503,
            'Rate limiting service temporarily unavailable. Please try again shortly.'
          );
        }
        const [command, ...commandArgs] = args;
        const result = await client.call(command, ...commandArgs);
        return result as RedisReply;
      }
    });
  }

  private async ensureScriptsReady(): Promise<void> {
    if (this.scriptsLoaded) return;
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        await this.inner.init({ windowMs: this.windowMs } as Options);
        this.scriptsLoaded = true;
      } catch (err) {
        this.scriptsLoaded = false;
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public async init(options: Options): Promise<void> {
    this.windowMs = options.windowMs;
    try {
      await this.ensureScriptsReady();
    } catch (err: any) {
      rateLimitStoreErrorsTotal.inc({
        policy: this.policyName,
        operation: 'init',
        environment: this.environment
      });
      logger.warn('[RATE_LIMIT] Redis script preload deferred (store currently unavailable)', {
        policy: this.policyName,
        errorDetail: err?.message || 'Redis unavailable'
      });
    }
  }

  public async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const startNs = process.hrtime.bigint();
    try {
      await this.ensureScriptsReady();
      return await this.inner.get(key);
    } catch (err: any) {
      this.scriptsLoaded = false;
      rateLimitStoreErrorsTotal.inc({
        policy: this.policyName,
        operation: 'get',
        environment: this.environment
      });
      throw this.wrapStoreError(err);
    } finally {
      observeStoreDuration(this.policyName, 'get', this.environment, startNs);
    }
  }

  public async increment(key: string): Promise<IncrementResponse> {
    const startNs = process.hrtime.bigint();
    try {
      await this.ensureScriptsReady();
      return await this.inner.increment(key);
    } catch (err: any) {
      this.scriptsLoaded = false;
      rateLimitStoreErrorsTotal.inc({
        policy: this.policyName,
        operation: 'increment',
        environment: this.environment
      });
      emitRateLimitAlert(
        'RATE_LIMIT_STORE_UNAVAILABLE',
        'HIGH',
        `Rate-limit Redis store increment failed for policy ${this.policyName}.`,
        { policy: this.policyName, errorDetail: err?.message || 'Store error' }
      );
      throw this.wrapStoreError(err);
    } finally {
      observeStoreDuration(this.policyName, 'increment', this.environment, startNs);
    }
  }

  public async decrement(key: string): Promise<void> {
    const startNs = process.hrtime.bigint();
    try {
      await this.inner.decrement(key);
    } catch (err: any) {
      // Never rethrow inside decrement(): express-rate-limit invokes it on finishPromise without catch()
      rateLimitStoreErrorsTotal.inc({
        policy: this.policyName,
        operation: 'decrement',
        environment: this.environment
      });
      logger.warn('[RATE_LIMIT] Post-response decrement failed (ignored safely)', {
        policy: this.policyName,
        errorDetail: err?.message || 'Store decrement error'
      });
    } finally {
      observeStoreDuration(this.policyName, 'decrement', this.environment, startNs);
    }
  }

  public async resetKey(key: string): Promise<void> {
    const startNs = process.hrtime.bigint();
    try {
      await this.inner.resetKey(key);
    } catch (err: any) {
      rateLimitStoreErrorsTotal.inc({
        policy: this.policyName,
        operation: 'reset',
        environment: this.environment
      });
      throw this.wrapStoreError(err);
    } finally {
      observeStoreDuration(this.policyName, 'reset', this.environment, startNs);
    }
  }

  private wrapStoreError(err: any): AppError {
    if (err instanceof AppError) return err;
    return new AppError(
      'RATE_LIMIT_STORE_UNAVAILABLE',
      503,
      'Rate limiting service temporarily unavailable. Please try again shortly.'
    );
  }
}

/**
 * Instrumented MemoryStore with unique prefix and latency metrics for dev/memory mode.
 */
class InstrumentedMemoryStore implements Store {
  public readonly prefix: string;
  public readonly localKeys = true;
  private readonly inner: MemoryStore;

  constructor(
    private readonly policyName: string,
    private readonly environment: string
  ) {
    this.prefix = `dp:mem:${policyName}:`;
    this.inner = new MemoryStore();
  }

  public init(options: Options): void {
    this.inner.init(options);
  }

  public async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const startNs = process.hrtime.bigint();
    try {
      return await this.inner.get(key);
    } finally {
      observeStoreDuration(this.policyName, 'get', this.environment, startNs);
    }
  }

  public async increment(key: string): Promise<IncrementResponse> {
    const startNs = process.hrtime.bigint();
    try {
      return await this.inner.increment(key);
    } finally {
      observeStoreDuration(this.policyName, 'increment', this.environment, startNs);
    }
  }

  public async decrement(key: string): Promise<void> {
    const startNs = process.hrtime.bigint();
    try {
      await this.inner.decrement(key);
    } finally {
      observeStoreDuration(this.policyName, 'decrement', this.environment, startNs);
    }
  }

  public async resetKey(key: string): Promise<void> {
    const startNs = process.hrtime.bigint();
    try {
      await this.inner.resetKey(key);
    } finally {
      observeStoreDuration(this.policyName, 'reset', this.environment, startNs);
    }
  }
}

export interface RateLimiterSuite {
  config: RateLimitConfig;
  activeStoreType: 'redis' | 'memory';
  loginIpRequest: RateLimitRequestHandler;
  loginIpFailed: RateLimitRequestHandler;
  loginAccountFailed: RateLimitRequestHandler;
  sessionRefresh: RateLimitRequestHandler;
  authenticatedApi: RateLimitRequestHandler;
  messageSending: RateLimitRequestHandler;
  messageRecipient: RateLimitRequestHandler;
  aiTranscription: RateLimitRequestHandler;
  aiTranscriptionConcurrency: RequestHandler;
  leadExport: RateLimitRequestHandler;
  leadImport: RateLimitRequestHandler;
  bulkUpdate: RateLimitRequestHandler;
  sensitiveAdmin: RateLimitRequestHandler;
  enforceImportBatchLimit: RequestHandler;
  duplicateSubmissionGuard: (scope: 'message' | 'export' | 'import' | 'bulk_update') => RequestHandler;
}

export interface CreateRateLimitersOptions {
  config?: RateLimitConfig;
  redis?: RedisService;
  redisClientProvider?: () => Redis | null;
}

function buildLimiter(params: {
  policyName: string;
  routeCategory: RouteCategory;
  windowMs: number;
  limit: number;
  message: string;
  store: Store;
  environment: string;
  passOnStoreError: boolean;
  skipSuccessfulRequests?: boolean;
  requestWasSuccessful?: (req: Request, res: Response) => boolean;
  skip?: (req: Request, res: Response) => boolean;
  keyGenerator: (req: Request, res: Response) => string;
}): RateLimitRequestHandler {
  const {
    policyName,
    routeCategory,
    windowMs,
    limit,
    message,
    store,
    environment,
    passOnStoreError,
    skipSuccessfulRequests = false,
    requestWasSuccessful,
    skip,
    keyGenerator
  } = params;

  const fallbackSymbol = Symbol(`rl_fallback_${policyName}`);
  const requestPropertyName = `rateLimit_${policyName}`;

  const erlLogger = {
    warn: (err: unknown, msg?: string) => {
      logger.warn(`[RATE_LIMIT:${policyName}] ${msg || 'Warning'}`, {
        policy: policyName,
        routeCategory,
        errorDetail: err instanceof Error ? err.message : String(err)
      });
    },
    error: (err: unknown, msg?: string) => {
      if (msg && msg.includes('allowing request without rate-limiting')) {
        rateLimitFallbackTotal.inc({
          policy: policyName,
          reason: 'store_error_fail_open',
          environment
        });
        emitRateLimitAlert(
          'RATE_LIMIT_FALLBACK_ACTIVE',
          'HIGH',
          `Rate limiter fail-open triggered for policy ${policyName}.`,
          { policy: policyName, routeCategory }
        );
      }
      logger.error(`[RATE_LIMIT:${policyName}] ${msg || 'Store error'}`, err instanceof Error ? err : null, {
        policy: policyName,
        routeCategory
      });
    }
  };

  const inner = rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    identifier: policyName,
    requestPropertyName,
    store,
    passOnStoreError,
    skipSuccessfulRequests,
    ...(requestWasSuccessful ? { requestWasSuccessful } : {}),
    ...(skip ? { skip } : {}),
    keyGenerator,
    logger: {
      warn: erlLogger.warn,
      error: (err, msg) => {
        erlLogger.error(err, msg);
      }
    },
    handler: (req: Request, res: Response) => {
      const requestId = req.securityContext?.requestId || crypto.randomUUID();
      const info = (req as any)[requestPropertyName] as
        | { limit: number; used: number; remaining: number; resetTime?: Date; key?: string }
        | undefined;

      const retryAfterHeader = res.getHeader('Retry-After');
      const retryAfterSeconds =
        typeof retryAfterHeader === 'string' || typeof retryAfterHeader === 'number'
          ? Math.max(1, Number(retryAfterHeader) || 1)
          : info?.resetTime
            ? Math.max(1, Math.ceil((info.resetTime.getTime() - Date.now()) / 1000))
            : Math.ceil(windowMs / 1000);

      rateLimitRequestsTotal.inc({
        policy: policyName,
        route_category: routeCategory,
        status_class: '429',
        environment
      });
      rateLimitExceededTotal.inc({
        policy: policyName,
        route_category: routeCategory,
        environment
      });

      logger.warn(
        '[RATE_LIMIT] Request blocked (429 Too Many Requests)',
        {
          policy: policyName,
          routeCategory,
          keyPrefix: info?.key ? info.key.slice(0, 32) : 'unknown',
          limit: info?.limit ?? limit,
          used: info?.used,
          retryAfterSeconds,
          requestId
        },
        req.securityContext
      );

      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        policy: policyName,
        retryAfterSeconds,
        requestId
      });
    }
  });

  const wrapper: RateLimitRequestHandler = Object.assign(
    ((req: Request, res: Response, next: NextFunction) => {
      if (skip && skip(req, res)) {
        rateLimitRequestsTotal.inc({
          policy: policyName,
          route_category: routeCategory,
          status_class: 'skipped',
          environment
        });
        return next();
      }

      return inner(req, res, (err?: any) => {
        if (err) {
          return next(err);
        }
        const hadLimitInfo = Boolean((req as any)[requestPropertyName]);
        const statusClass = hadLimitInfo ? 'allowed' : passOnStoreError ? 'fallback' : 'allowed';
        if ((req as any)[fallbackSymbol]) {
          // explicit fallback marker
        }
        rateLimitRequestsTotal.inc({
          policy: policyName,
          route_category: routeCategory,
          status_class: statusClass,
          environment
        });
        next();
      });
    }) as RequestHandler,
    {
      resetKey: (key: string) => inner.resetKey(key),
      getKey: (key: string) => inner.getKey(key)
    }
  );

  return wrapper;
}

/**
 * Validates Redis readiness if required, initializes shared stores,
 * and constructs all production rate-limiting middlewares.
 */
export async function createRateLimiters(
  options: CreateRateLimitersOptions = {}
): Promise<RateLimiterSuite> {
  const config = options.config ?? loadRateLimitConfig();
  const redis = options.redis ?? redisService;
  const getRedisClient = options.redisClientProvider ?? (() => redis.getClient());

  let activeStoreType: 'redis' | 'memory' = config.storeMode;

  if (config.storeMode === 'redis') {
    const clientAlreadyReady = Boolean(getRedisClient());
    const ready = clientAlreadyReady ? true : await redis.ensureReady(3000);

    if (!ready && !getRedisClient()) {
      if (config.requireRedis) {
        const lastErr = redis.getLastError()?.message || 'Redis unreachable or not configured';
        throw new Error(
          `FATAL: Distributed Redis rate-limit store is required (RATE_LIMIT_REQUIRE_REDIS=true), but Redis is unavailable: ${lastErr}`
        );
      }
      activeStoreType = 'memory';
      rateLimitFallbackTotal.inc({
        policy: 'startup',
        reason: 'redis_unavailable_at_boot',
        environment: config.environment
      });
      emitRateLimitAlert(
        'RATE_LIMIT_STARTUP_MEMORY_FALLBACK',
        'HIGH',
        'Redis unavailable at startup; falling back to per-instance MemoryStore (non-distributed).',
        { environment: config.environment }
      );
      logger.warn(
        '[RATE_LIMIT] Redis unavailable at startup; falling back to local MemoryStore (RATE_LIMIT_REQUIRE_REDIS=false).'
      );
    }
  }

  const createStore = (policyName: string): Store => {
    if (activeStoreType === 'redis') {
      return new ResilientRedisStore(policyName, config.environment, getRedisClient);
    }
    return new InstrumentedMemoryStore(policyName, config.environment);
  };

  const { keySecret, ipv6Subnet, environment, policies } = config;
  const strictPassOnStoreError = false;
  const apiPassOnStoreError = config.apiFailOpen;

  // 1a. Login IP overall request ceiling (protects DB/bcrypt against high-volume sprays)
  const loginIpRequest = buildLimiter({
    policyName: 'login_ip_request',
    routeCategory: 'auth',
    windowMs: policies.loginIpRequest.windowMs,
    limit: policies.loginIpRequest.limit,
    message: 'Too many login requests from this network. Please try again later.',
    store: createStore('login_ip_request'),
    environment,
    passOnStoreError: strictPassOnStoreError,
    keyGenerator: (req) => {
      const normalizedIp = ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1', ipv6Subnet);
      return createHmacSafeKey('rl:login_ip_req', 'global', normalizedIp, keySecret);
    }
  });

  // 1b. Login IP failed-attempt limiter (counts 401 failures only)
  const loginIpFailed = buildLimiter({
    policyName: 'login_ip_failed',
    routeCategory: 'auth',
    windowMs: policies.loginIpFailed.windowMs,
    limit: policies.loginIpFailed.limit,
    message: 'Too many failed login attempts from this network. Please try again in 15 minutes.',
    store: createStore('login_ip_failed'),
    environment,
    passOnStoreError: strictPassOnStoreError,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) => res.statusCode !== 401 && res.statusCode !== 429,
    keyGenerator: (req) => {
      const normalizedIp = ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1', ipv6Subnet);
      return createHmacSafeKey('rl:login_ip_fail', 'global', normalizedIp, keySecret);
    }
  });

  // 1c. Login Account failed-attempt limiter (cross-IP protection via NFKC normalized HMAC email)
  const loginAccountFailed = buildLimiter({
    policyName: 'login_account_failed',
    routeCategory: 'auth',
    windowMs: policies.loginAccountFailed.windowMs,
    limit: policies.loginAccountFailed.limit,
    message: 'Too many failed login attempts for this account. Please try again in 15 minutes.',
    store: createStore('login_account_failed'),
    environment,
    passOnStoreError: strictPassOnStoreError,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) => res.statusCode !== 401,
    skip: (req) => normalizeEmailForRateLimit(req.body?.email) === null,
    keyGenerator: (req) => {
      const normalizedEmail = normalizeEmailForRateLimit(req.body?.email) || 'invalid';
      return createHmacSafeKey('rl:login_acct_fail', 'global', normalizedEmail, keySecret);
    }
  });

  // 2. Session refresh protection (HMAC refresh token cookie + trusted IP subnet)
  const sessionRefresh = buildLimiter({
    policyName: 'session_refresh',
    routeCategory: 'session',
    windowMs: policies.sessionRefresh.windowMs,
    limit: policies.sessionRefresh.limit,
    message: 'Too many token refresh attempts. Please sign in again shortly.',
    store: createStore('session_refresh'),
    environment,
    passOnStoreError: strictPassOnStoreError,
    keyGenerator: (req) => {
      const cookies = parseCookiesHeader(req.headers.cookie);
      const token = cookies['refreshToken'] || '';
      const normalizedIp = ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1', ipv6Subnet);
      const composite = token ? `tok:${token}:ip:${normalizedIp}` : `ip:${normalizedIp}`;
      return createHmacSafeKey('rl:refresh', 'global', composite, keySecret);
    }
  });

  // 3. General authenticated API limiter (runs after authenticateToken + enforceTenantScope)
  const authenticatedApi = buildLimiter({
    policyName: 'authenticated_api',
    routeCategory: 'api',
    windowMs: policies.authenticatedApi.windowMs,
    limit: policies.authenticatedApi.limit,
    message: 'API rate limit exceeded. Please slow down and retry after the reset window.',
    store: createStore('authenticated_api'),
    environment,
    passOnStoreError: apiPassOnStoreError,
    skip: (req) => {
      if (req.method === 'OPTIONS') return true;
      const p = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
      return (
        p === '/api/health' ||
        p === '/api/auth/login' ||
        p === '/api/auth/refresh'
      );
    },
    keyGenerator: (req) => {
      const tenantId = req.securityContext?.tenantId || (req.securityContext?.isPlatformStaff ? 'platform' : 'anon');
      const userId = req.securityContext?.actorUserId || req.user?.id;
      if (userId) {
        return createHmacSafeKey('rl:api', tenantId, `usr:${userId}`, keySecret);
      }
      const normalizedIp = ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1', ipv6Subnet);
      return createHmacSafeKey('rl:api', tenantId, `ip:${normalizedIp}`, keySecret);
    }
  });

  // 4a. Message sending per-user limiter
  const messageSending = buildLimiter({
    policyName: 'message_sending',
    routeCategory: 'messaging',
    windowMs: policies.messageSending.windowMs,
    limit: policies.messageSending.limit,
    message: 'Message sending rate limit exceeded. Please wait before dispatching additional messages.',
    store: createStore('message_sending'),
    environment,
    passOnStoreError: strictPassOnStoreError,
    keyGenerator: (req) => {
      const tenantId = req.securityContext?.tenantId || 'platform';
      const userId = req.securityContext?.actorUserId || req.user?.id;
      if (userId) {
        return createHmacSafeKey('rl:msg_user', tenantId, `usr:${userId}`, keySecret);
      }
      const normalizedIp = ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1', ipv6Subnet);
      return createHmacSafeKey('rl:msg_user', tenantId, `ip:${normalizedIp}`, keySecret);
    }
  });

  // 4b. Message recipient anti-spam limiter (protects individual leads from bursts)
  const messageRecipient = buildLimiter({
    policyName: 'message_recipient',
    routeCategory: 'messaging',
    windowMs: policies.messageRecipient.windowMs,
    limit: policies.messageRecipient.limit,
    message: 'Recipient outreach burst limit reached. Please space out messages to this contact.',
    store: createStore('message_recipient'),
    environment,
    passOnStoreError: strictPassOnStoreError,
    skip: (req) => {
      const leadId = req.body?.leadId;
      return typeof leadId !== 'string' || leadId.trim().length === 0;
    },
    keyGenerator: (req) => {
      const tenantId = req.securityContext?.tenantId || 'platform';
      const leadId = String(req.body?.leadId || 'unknown').trim();
      return createHmacSafeKey('rl:msg_recip', tenantId, `lead:${leadId}`, keySecret);
    }
  });

  // 5a. AI transcription rate limit
  const aiTranscription = buildLimiter({
    policyName: 'ai_transcription',
    routeCategory: 'ai',
    windowMs: policies.aiTranscription.windowMs,
    limit: policies.aiTranscription.limit,
    message: 'AI transcription rate limit exceeded. Please wait before submitting additional audio.',
    store: createStore('ai_transcription'),
    environment,
    passOnStoreError: strictPassOnStoreError,
    keyGenerator: (req) => {
      const tenantId = req.securityContext?.tenantId || 'platform';
      const userId = req.securityContext?.actorUserId || req.user?.id;
      if (userId) {
        return createHmacSafeKey('rl:ai_transcribe', tenantId, `usr:${userId}`, keySecret);
      }
      const normalizedIp = ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1', ipv6Subnet);
      return createHmacSafeKey('rl:ai_transcribe', tenantId, `ip:${normalizedIp}`, keySecret);
    }
  });

  // 5b. AI transcription concurrency limiter (per tenant+user in-flight lock)
  const memoryConcurrencyMap = new Map<string, number>();
  const aiTranscriptionConcurrency: RequestHandler = async (req, res, next) => {
    const tenantId = req.securityContext?.tenantId || 'platform';
    const userId = req.securityContext?.actorUserId || req.user?.id || getTrustedClientIp(req);
    const key = createHmacSafeKey('conc:transcribe', tenantId, `usr:${userId}`, keySecret);
    const maxConcurrent = config.transcribeMaxConcurrent;

    let current = 0;
    let usingRedis = false;

    if (activeStoreType === 'redis') {
      const client = getRedisClient();
      if (!client || client.status !== 'ready') {
        rateLimitStoreErrorsTotal.inc({
          policy: 'ai_transcription_concurrency',
          operation: 'increment',
          environment
        });
        return next(
          new AppError(
            'RATE_LIMIT_STORE_UNAVAILABLE',
            503,
            'Rate limiting service temporarily unavailable. Please try again shortly.'
          )
        );
      }
      try {
        usingRedis = true;
        current = await client.incr(key);
        if (current === 1) {
          await client.expire(key, 120);
        }
      } catch {
        rateLimitStoreErrorsTotal.inc({
          policy: 'ai_transcription_concurrency',
          operation: 'increment',
          environment
        });
        return next(
          new AppError(
            'RATE_LIMIT_STORE_UNAVAILABLE',
            503,
            'Rate limiting service temporarily unavailable. Please try again shortly.'
          )
        );
      }
    } else {
      current = (memoryConcurrencyMap.get(key) || 0) + 1;
      memoryConcurrencyMap.set(key, current);
    }

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      if (usingRedis) {
        const client = getRedisClient();
        if (client && client.status === 'ready') {
          void client.decr(key).catch(() => {});
        }
      } else {
        const val = (memoryConcurrencyMap.get(key) || 1) - 1;
        if (val <= 0) memoryConcurrencyMap.delete(key);
        else memoryConcurrencyMap.set(key, val);
      }
    };

    res.once('finish', release);
    res.once('close', release);

    if (current > maxConcurrent) {
      release();
      rateLimitExceededTotal.inc({
        policy: 'ai_transcription_concurrency',
        route_category: 'ai',
        environment
      });
      res.setHeader('Retry-After', '5');
      return res.status(429).json({
        error: 'Too many concurrent AI transcription requests in flight. Please wait for an active request to complete.',
        code: 'RATE_LIMIT_EXCEEDED',
        policy: 'ai_transcription_concurrency',
        retryAfterSeconds: 5,
        requestId: req.securityContext?.requestId || crypto.randomUUID()
      });
    }

    next();
  };

  // 6. Lead export job limiter
  const leadExport = buildLimiter({
    policyName: 'lead_export',
    routeCategory: 'export',
    windowMs: policies.leadExport.windowMs,
    limit: policies.leadExport.limit,
    message: 'Lead export rate limit exceeded. Please wait before requesting another export job.',
    store: createStore('lead_export'),
    environment,
    passOnStoreError: strictPassOnStoreError,
    keyGenerator: (req) => {
      const tenantId = req.securityContext?.tenantId || 'platform';
      const userId = req.securityContext?.actorUserId || req.user?.id;
      if (userId) {
        return createHmacSafeKey('rl:export', tenantId, `usr:${userId}`, keySecret);
      }
      const normalizedIp = ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1', ipv6Subnet);
      return createHmacSafeKey('rl:export', tenantId, `ip:${normalizedIp}`, keySecret);
    }
  });

  // 7. Lead import job limiter
  const leadImport = buildLimiter({
    policyName: 'lead_import',
    routeCategory: 'import',
    windowMs: policies.leadImport.windowMs,
    limit: policies.leadImport.limit,
    message: 'Lead import rate limit exceeded. Please wait before starting another import job.',
    store: createStore('lead_import'),
    environment,
    passOnStoreError: strictPassOnStoreError,
    keyGenerator: (req) => {
      const tenantId = req.securityContext?.tenantId || 'platform';
      const userId = req.securityContext?.actorUserId || req.user?.id;
      if (userId) {
        return createHmacSafeKey('rl:import', tenantId, `usr:${userId}`, keySecret);
      }
      const normalizedIp = ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1', ipv6Subnet);
      return createHmacSafeKey('rl:import', tenantId, `ip:${normalizedIp}`, keySecret);
    }
  });

  // 8. Bulk update limiter
  const bulkUpdate = buildLimiter({
    policyName: 'bulk_update',
    routeCategory: 'bulk',
    windowMs: policies.bulkUpdate.windowMs,
    limit: policies.bulkUpdate.limit,
    message: 'Bulk lead update rate limit exceeded. Please wait before queuing another bulk update.',
    store: createStore('bulk_update'),
    environment,
    passOnStoreError: strictPassOnStoreError,
    keyGenerator: (req) => {
      const tenantId = req.securityContext?.tenantId || 'platform';
      const userId = req.securityContext?.actorUserId || req.user?.id;
      if (userId) {
        return createHmacSafeKey('rl:bulk_update', tenantId, `usr:${userId}`, keySecret);
      }
      const normalizedIp = ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1', ipv6Subnet);
      return createHmacSafeKey('rl:bulk_update', tenantId, `ip:${normalizedIp}`, keySecret);
    }
  });

  // 9. Sensitive admin/auth/platform operations limiter
  const sensitiveAdmin = buildLimiter({
    policyName: 'sensitive_admin',
    routeCategory: 'admin',
    windowMs: policies.sensitiveAdmin.windowMs,
    limit: policies.sensitiveAdmin.limit,
    message: 'Too many sensitive administrative requests. Please try again later.',
    store: createStore('sensitive_admin'),
    environment,
    passOnStoreError: strictPassOnStoreError,
    keyGenerator: (req) => {
      const tenantId = req.securityContext?.tenantId || 'platform';
      const userId = req.securityContext?.actorUserId || req.user?.id;
      if (userId) {
        return createHmacSafeKey('rl:sensitive', tenantId, `usr:${userId}`, keySecret);
      }
      const normalizedIp = ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1', ipv6Subnet);
      return createHmacSafeKey('rl:sensitive', tenantId, `ip:${normalizedIp}`, keySecret);
    }
  });

  // Import batch size guard (bounds payload size cleanly)
  const enforceImportBatchLimit: RequestHandler = (req, res, next) => {
    const rawLeads = req.body?.leads;
    if (Array.isArray(rawLeads) && rawLeads.length > config.importMaxBatchSize) {
      return res.status(400).json({
        error: `Import batch size (${rawLeads.length}) exceeds maximum permitted limit of ${config.importMaxBatchSize} records per request.`,
        code: 'BATCH_LIMIT_EXCEEDED',
        maxBatchSize: config.importMaxBatchSize
      });
    }
    next();
  };

  // Idempotency / duplicate submission guard for messages and background jobs
  const memoryIdempMap = new Map<string, number>();
  const duplicateSubmissionGuard = (
    scope: 'message' | 'export' | 'import' | 'bulk_update'
  ): RequestHandler => {
    return async (req, res, next) => {
      const rawKey =
        (req.headers['idempotency-key'] as string | undefined)?.trim() ||
        (req.headers['x-idempotency-key'] as string | undefined)?.trim() ||
        (typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : undefined);

      if (!rawKey) {
        return next();
      }
      if (rawKey.length > 128) {
        return res.status(400).json({
          error: 'Idempotency-Key header exceeds maximum length of 128 characters.',
          code: 'VALIDATION_ERROR'
        });
      }

      const tenantId = req.securityContext?.tenantId || 'platform';
      const userId = req.securityContext?.actorUserId || req.user?.id || 'anon';
      const ttl = scope === 'message' ? config.idempotencyTtlSeconds : config.jobDedupTtlSeconds;
      const lockKey = createHmacSafeKey(`idemp:${scope}`, tenantId, `${userId}:${rawKey}`, keySecret);

      let acquired = false;
      if (activeStoreType === 'redis') {
        const client = getRedisClient();
        if (!client || client.status !== 'ready') {
          rateLimitStoreErrorsTotal.inc({
            policy: `idempotency_${scope}`,
            operation: 'setnx',
            environment
          });
          return next(
            new AppError(
              'RATE_LIMIT_STORE_UNAVAILABLE',
              503,
              'Rate limiting service temporarily unavailable. Please try again shortly.'
            )
          );
        }
        try {
          const result = await client.set(lockKey, '1', 'EX', ttl, 'NX');
          acquired = result === 'OK';
        } catch {
          rateLimitStoreErrorsTotal.inc({
            policy: `idempotency_${scope}`,
            operation: 'setnx',
            environment
          });
          return next(
            new AppError(
              'RATE_LIMIT_STORE_UNAVAILABLE',
              503,
              'Rate limiting service temporarily unavailable. Please try again shortly.'
            )
          );
        }
      } else {
        const now = Date.now();
        const existingExpiry = memoryIdempMap.get(lockKey);
        if (existingExpiry && existingExpiry > now) {
          acquired = false;
        } else {
          memoryIdempMap.set(lockKey, now + ttl * 1000);
          acquired = true;
        }
      }

      if (!acquired) {
        return res.status(409).json({
          error: `Duplicate ${scope.replace('_', ' ')} submission blocked by idempotency guard.`,
          code: scope === 'message' ? 'DUPLICATE_SUBMISSION' : 'DUPLICATE_JOB_SUBMISSION',
          requestId: req.securityContext?.requestId
        });
      }

      next();
    };
  };

  return {
    config,
    activeStoreType,
    loginIpRequest,
    loginIpFailed,
    loginAccountFailed,
    sessionRefresh,
    authenticatedApi,
    messageSending,
    messageRecipient,
    aiTranscription,
    aiTranscriptionConcurrency,
    leadExport,
    leadImport,
    bulkUpdate,
    sensitiveAdmin,
    enforceImportBatchLimit,
    duplicateSubmissionGuard
  };
}
