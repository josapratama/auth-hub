import type { Request } from "express";

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "127.0.0.1";
}

export function isRateLimited(
  key: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
  lockoutMs = 15 * 60 * 1000
): { limited: boolean; remainingMs: number } {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry) {
    return { limited: false, remainingMs: 0 };
  }

  // Check if currently locked out
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { limited: true, remainingMs: entry.blockedUntil - now };
  }

  // Window reset
  if (now - entry.firstAttempt > windowMs) {
    rateLimits.delete(key);
    return { limited: false, remainingMs: 0 };
  }

  if (entry.count >= maxAttempts) {
    entry.blockedUntil = now + lockoutMs;
    return { limited: true, remainingMs: lockoutMs };
  }

  return { limited: false, remainingMs: 0 };
}

export function recordFailedAttempt(key: string, maxAttempts = 5, lockoutMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry) {
    rateLimits.set(key, { count: 1, firstAttempt: now });
    return;
  }

  entry.count++;
  if (entry.count >= maxAttempts) {
    entry.blockedUntil = now + lockoutMs;
  }
}

export function clearRateLimit(key: string) {
  rateLimits.delete(key);
}
