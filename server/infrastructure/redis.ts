import { Redis, RedisOptions } from 'ioredis';
import crypto from 'crypto';
import { logger } from './logger';
import { redisConnectionErrors } from './metrics';

/**
 * ------------------------------------------------------------------
 * Redis Shared Infrastructure Abstraction
 * ------------------------------------------------------------------
 * Provides the authoritative Redis client abstraction for the application.
 * Handles connection lifecycle, bounded retries, explicit startup readiness,
 * and exposes both graceful-fallback primitives and strict distributed
 * coordination primitives for rate limiting and idempotency.
 */

function buildOptions(connectTimeoutMs = 3000): RedisOptions {
  return {
    maxRetriesPerRequest: 1, // Fail fast when Redis is down instead of hanging requests
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: connectTimeoutMs,
    retryStrategy(times) {
      if (times > 5) {
        return null; // Bounded retry ceiling to prevent infinite log spam
      }
      return Math.min(times * 250, 2000);
    },
    reconnectOnError(err) {
      if (err.message.includes('READONLY')) {
        return true;
      }
      return false;
    }
  };
}

interface MemoryEntry {
  value: string;
  expiresAt?: number;
}

export class RedisService {
  private redisUrl: string | undefined;
  private client: Redis | null = null;
  private connectionError: Error | null = null;
  private isDegradedMode: boolean = false;
  private hasLoggedWarning: boolean = false;
  private readyPromise: Promise<boolean> | null = null;
  private memoryStore = new Map<string, MemoryEntry>();

  constructor(redisUrl: string | undefined = process.env.REDIS_URL) {
    this.redisUrl = redisUrl?.trim() || undefined;
    this.init();
  }

  private init() {
    if (!this.redisUrl) {
      this.isDegradedMode = true;
      this.readyPromise = Promise.resolve(false);
      logger.info('[REDIS] No REDIS_URL provided. Running in degraded mode with in-memory fallback.');
      return;
    }

    try {
      this.client = new Redis(this.redisUrl, buildOptions());
      this.setupListeners();

      this.readyPromise = new Promise<boolean>((resolve) => {
        if (!this.client) {
          resolve(false);
          return;
        }

        const onReady = () => {
          cleanup();
          resolve(true);
        };
        const onEnd = () => {
          cleanup();
          resolve(false);
        };
        const cleanup = () => {
          this.client?.off('ready', onReady);
          this.client?.off('end', onEnd);
        };

        this.client.once('ready', onReady);
        this.client.once('end', onEnd);

        this.client.connect().catch((err: any) => {
          this.connectionError = err;
          if (!this.hasLoggedWarning) {
            this.hasLoggedWarning = true;
            logger.warn(`[REDIS] Connection to Redis could not be established (${err.message}).`);
          }
          this.isDegradedMode = true;
          cleanup();
          resolve(false);
        });
      });
    } catch (err: any) {
      logger.warn(`[REDIS] Failed to initialize Redis client: ${err.message}.`);
      this.client = null;
      this.isDegradedMode = true;
      this.readyPromise = Promise.resolve(false);
    }
  }

  private setupListeners() {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.debug('[REDIS] Attempting connection...');
    });

    this.client.on('ready', () => {
      this.connectionError = null;
      this.isDegradedMode = false;
      this.hasLoggedWarning = false;
      logger.info('[REDIS] Connection established and ready.');
    });

    this.client.on('error', (err: any) => {
      this.connectionError = err;
      redisConnectionErrors.inc();

      if (err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED')) {
        if (!this.hasLoggedWarning) {
          this.hasLoggedWarning = true;
          logger.warn('[REDIS] Connection refused by Redis server.');
        }
      } else {
        logger.error('[REDIS] Connection error', err);
      }
    });

    this.client.on('close', () => {
      this.isDegradedMode = true;
      logger.warn('[REDIS] Connection closed.');
    });

    this.client.on('end', () => {
      this.isDegradedMode = true;
      logger.info('[REDIS] Connection ended.');
    });

    this.client.on('reconnecting', () => {
      if (!this.hasLoggedWarning) {
        logger.info('[REDIS] Attempting to reconnect...');
      }
    });
  }

  public isConfigured(): boolean {
    return Boolean(this.redisUrl);
  }

  public getLastError(): Error | null {
    return this.connectionError;
  }

  /**
   * Wait for initial Redis readiness (up to timeoutMs) before mounting rate limiters.
   */
  public async ensureReady(timeoutMs = 3000): Promise<boolean> {
    if (this.isAvailable()) return true;
    if (!this.redisUrl) return false;

    if (this.client && (this.client.status === 'end' || this.client.status === 'close')) {
      return this.reconnect(timeoutMs);
    }

    if (!this.readyPromise) return false;

    let timer: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(this.isAvailable()), timeoutMs);
        timer.unref?.();
      });
      return await Promise.race([this.readyPromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Re-initializes the Redis connection if the previous client ended.
   */
  public async reconnect(timeoutMs = 3000): Promise<boolean> {
    if (!this.redisUrl) return false;
    if (this.isAvailable()) return true;

    if (this.client) {
      try {
        this.client.removeAllListeners();
        this.client.disconnect(false);
      } catch {
        // Ignore cleanup errors
      }
      this.client = null;
    }

    this.isDegradedMode = false;
    this.hasLoggedWarning = false;
    this.init();
    return this.ensureReady(timeoutMs);
  }

  /**
   * Returns true if Redis is connected and ready to accept commands.
   */
  public isAvailable(): boolean {
    return !this.isDegradedMode && this.client !== null && this.client.status === 'ready';
  }

  /**
   * Returns true if operating under in-memory degraded mode.
   */
  public isDegraded(): boolean {
    return this.isDegradedMode || !this.client || this.client.status !== 'ready';
  }

  /**
   * Returns the underlying ioredis client instance if connected and ready, otherwise null.
   */
  public getClient(): Redis | null {
    if (!this.isAvailable()) {
      return null;
    }
    return this.client;
  }

  /**
   * Returns the underlying ioredis client regardless of transient status (for stores managing own error propagation).
   */
  public getRawClient(): Redis | null {
    return this.client;
  }

  /**
   * Health check for readiness probes.
   * Accurately returns false when Redis is unconfigured, disconnected, or unreachable.
   */
  public async ping(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const res = await this.client!.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Strict distributed SET NX EX operation for idempotency / duplicate guards.
   * Throws when Redis is unavailable so callers can decide fail-closed vs fallback.
   */
  public async setNxStrict(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      throw new Error('Redis client unavailable for strict SET NX operation');
    }
    const result = await client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Best-effort SET NX EX with in-memory fallback for non-strict local dev mode.
   */
  public async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (this.isAvailable()) {
      try {
        return await this.setNxStrict(key, value, ttlSeconds);
      } catch {
        // Fall through to in-memory fallback below
      }
    }
    const now = Date.now();
    const existing = this.memoryStore.get(key);
    if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
      return false;
    }
    this.memoryStore.set(key, {
      value,
      expiresAt: now + ttlSeconds * 1000
    });
    return true;
  }

  // -------------------------------------------------------------
  // Data Primitives with automatic in-memory fallback
  // -------------------------------------------------------------

  public async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      const item = this.memoryStore.get(key);
      if (!item) return null;
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.memoryStore.delete(key);
        return null;
      }
      return item.value;
    }
    try {
      return await this.client!.get(key);
    } catch {
      const item = this.memoryStore.get(key);
      return item?.value || null;
    }
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isAvailable()) {
      this.memoryStore.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
      });
      return;
    }
    try {
      if (ttlSeconds) {
        await this.client!.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client!.set(key, value);
      }
    } catch {
      this.memoryStore.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
      });
    }
  }

  public async delete(key: string): Promise<number> {
    if (!this.isAvailable()) {
      const existed = this.memoryStore.delete(key);
      return existed ? 1 : 0;
    }
    try {
      return await this.client!.del(key);
    } catch {
      return this.memoryStore.delete(key) ? 1 : 0;
    }
  }

  public async increment(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.isAvailable()) {
      const item = this.memoryStore.get(key);
      let current = 0;
      if (item && (!item.expiresAt || Date.now() <= item.expiresAt)) {
        current = parseInt(item.value, 10) || 0;
      }
      const next = current + 1;
      this.memoryStore.set(key, {
        value: String(next),
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : item?.expiresAt
      });
      return next;
    }
    try {
      if (ttlSeconds) {
        const res = await this.client!
          .multi()
          .incr(key)
          .expire(key, ttlSeconds, 'NX')
          .exec();

        if (!res || !res[0]) throw new Error('Increment failed');
        return res[0][1] as number;
      } else {
        return await this.client!.incr(key);
      }
    } catch {
      const item = this.memoryStore.get(key);
      const current = parseInt(item?.value || '0', 10) || 0;
      const next = current + 1;
      this.memoryStore.set(key, {
        value: String(next),
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
      });
      return next;
    }
  }

  // -------------------------------------------------------------
  // Clean Shutdown
  // -------------------------------------------------------------

  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
    }
    this.isDegradedMode = true;
  }
}

export const redisService = new RedisService();

/**
 * Utility for creating tenant-safe deterministic hash keys for Redis.
 * Useful for anonymizing IPs or sensitive IDs before using as keys.
 */
export function createSafeKey(namespace: string, tenantId: string, sensitiveIdentifier: string): string {
  const hash = crypto.createHash('sha256').update(sensitiveIdentifier).digest('hex');
  return `dp:${namespace}:${tenantId}:${hash}`;
}

/**
 * Keyed HMAC-SHA256 key builder so PII (emails, tokens, IPs) cannot be probed via offline dictionary hashing.
 */
export function createHmacSafeKey(
  namespace: string,
  tenantId: string,
  sensitiveIdentifier: string,
  secret: string
): string {
  const hmac = crypto.createHmac('sha256', secret).update(sensitiveIdentifier).digest('hex');
  return `dp:${namespace}:${tenantId}:${hmac}`;
}

