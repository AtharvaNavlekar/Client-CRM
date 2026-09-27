import { Redis, RedisOptions } from 'ioredis';
import crypto from 'crypto';
import { logger } from './logger';
import { redisConnectionErrors } from './metrics';

/**
 * ------------------------------------------------------------------
 * Redis Shared Infrastructure Abstraction
 * ------------------------------------------------------------------
 * This module provides the authoritative Redis client abstraction
 * for the application. It handles connection lifecycle, reconnections,
 * and exposes primitive operations for rate limiting, locking, and 
 * transient state coordination.
 * 
 * In environments where Redis is unavailable (e.g. local dev, test,
 * container preview), it seamlessly degrades to in-memory coordination
 * without continuous reconnection spam or application crashes.
 */

const REDIS_URL = process.env.REDIS_URL;

// Base options focusing on safe retry and timeout behavior
const baseOptions: RedisOptions = {
  maxRetriesPerRequest: 1, // Don't block requests indefinitely if Redis is down
  enableReadyCheck: true,
  lazyConnect: true, // Connect explicitly so we can catch initial failures gracefully
  connectTimeout: 3000,
  retryStrategy(times) {
    // If Redis is unreachable, avoid infinite error loops
    if (times > 3) {
      return null; // Stop reconnecting after 3 attempts
    }
    return Math.min(times * 300, 2000);
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  }
};

interface MemoryEntry {
  value: string;
  expiresAt?: number;
}

class RedisService {
  private client: Redis | null = null;
  private isConnecting: boolean = false;
  private connectionError: Error | null = null;
  private isDegradedMode: boolean = false;
  private hasLoggedWarning: boolean = false;
  private memoryStore = new Map<string, MemoryEntry>();

  constructor() {
    this.init();
  }

  private init() {
    if (!REDIS_URL || REDIS_URL.trim() === '') {
      this.isDegradedMode = true;
      logger.info('[REDIS] No REDIS_URL provided. Running in degraded mode with in-memory fallback.');
      return;
    }

    try {
      this.client = new Redis(REDIS_URL, baseOptions);
      this.setupListeners();

      // Initiate connection explicitly with catch handler
      this.client.connect().catch((err: any) => {
        if (!this.hasLoggedWarning) {
          this.hasLoggedWarning = true;
          logger.warn(`[REDIS] Connection to ${REDIS_URL} could not be established (${err.message}). Using in-memory fallback.`);
        }
        this.isDegradedMode = true;
      });
    } catch (err: any) {
      logger.warn(`[REDIS] Failed to initialize Redis client: ${err.message}. Operating with in-memory fallback.`);
      this.client = null;
      this.isDegradedMode = true;
    }
  }

  private setupListeners() {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.debug('[REDIS] Attempting connection...');
    });

    this.client.on('ready', () => {
      this.isConnecting = false;
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
          logger.warn(`[REDIS] Connection refused at ${REDIS_URL}. Falling back to in-memory store.`);
        }
      } else {
        logger.error('[REDIS] Connection error', err);
      }
    });

    this.client.on('close', () => {
      logger.warn('[REDIS] Connection closed.');
    });

    this.client.on('end', () => {
      this.isDegradedMode = true;
      logger.info('[REDIS] Connection ended. In-memory fallback active.');
    });

    this.client.on('reconnecting', () => {
      if (!this.hasLoggedWarning) {
        logger.info('[REDIS] Attempting to reconnect...');
      }
    });
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
   * Health check for readiness probes
   */
  public async ping(): Promise<boolean> {
    if (!this.isAvailable()) return true;
    try {
      const res = await this.client!.ping();
      return res === 'PONG';
    } catch {
      return true;
    }
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
