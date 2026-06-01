import { createClient } from 'redis';

/**
 * Redis Caching Module for Hot Data and Session Management.
 * Optimized caching layer for reducing neon database access frequencies.
 */

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Successfully connected to Redis Caching Layer.'));

// Connect asynchronously (fail silently in environments without local Redis to maintain reliability)
let isRedisConnected = false;
(async () => {
    try {
        await redisClient.connect();
        isRedisConnected = true;
    } catch (e) {
        console.warn('Redis is not running. Caching will fall back to direct DB queries.');
    }
})();

/**
 * Cache-Aside Cache Get Helper
 */
export const cacheGet = async (key) => {
    if (!isRedisConnected) return null;
    try {
        const value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
    } catch (e) {
        console.error('Redis get error:', e);
        return null;
    }
};

/**
 * Cache-Aside Cache Set Helper with Expiration (TTL)
 */
export const cacheSet = async (key, value, ttlSeconds = 300) => {
    if (!isRedisConnected) return false;
    try {
        await redisClient.set(key, JSON.stringify(value), {
            EX: ttlSeconds
        });
        return true;
    } catch (e) {
        console.error('Redis set error:', e);
        return false;
    }
};

/**
 * Cache Invalidation Helper
 */
export const cacheDelete = async (key) => {
    if (!isRedisConnected) return false;
    try {
        await redisClient.del(key);
        return true;
    } catch (e) {
        console.error('Redis delete error:', e);
        return false;
    }
};

export default redisClient;
