/**
 * In-memory sliding-window rate limiter. Single-instance only — fine for
 * Vercel Hobby (one region, one process). Resets on cold start, which is
 * acceptable for the hackathon demo profile.
 *
 * Two scopes:
 *   - per-IP: prevents one client from monopolizing the agent
 *   - global: protects the shared Gemini daily quota by capping aggregate RPM
 */

const WINDOW_MS = 60_000;
const PER_IP_LIMIT = 3;
const GLOBAL_LIMIT = 8;

const ipHits = new Map<string, number[]>();
const globalHits: number[] = [];

function prune(timestamps: number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;
  let i = 0;
  while (i < timestamps.length && timestamps[i] < cutoff) i++;
  return i === 0 ? timestamps : timestamps.slice(i);
}

function retryAfterSeconds(timestamps: number[], limit: number, now: number): number {
  if (timestamps.length < limit) return 0;
  const oldestRelevant = timestamps[timestamps.length - limit];
  const msUntilFree = oldestRelevant + WINDOW_MS - now;
  return Math.max(1, Math.ceil(msUntilFree / 1000));
}

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; scope: "ip" | "global"; retryAfterSeconds: number };

export function checkRateLimit(ip: string): RateLimitDecision {
  const now = Date.now();

  const ipTimestamps = prune(ipHits.get(ip) ?? [], now);
  if (ipTimestamps.length >= PER_IP_LIMIT) {
    ipHits.set(ip, ipTimestamps);
    return {
      ok: false,
      scope: "ip",
      retryAfterSeconds: retryAfterSeconds(ipTimestamps, PER_IP_LIMIT, now),
    };
  }

  const prunedGlobal = prune(globalHits, now);
  if (prunedGlobal.length >= GLOBAL_LIMIT) {
    globalHits.length = 0;
    globalHits.push(...prunedGlobal);
    return {
      ok: false,
      scope: "global",
      retryAfterSeconds: retryAfterSeconds(prunedGlobal, GLOBAL_LIMIT, now),
    };
  }

  ipTimestamps.push(now);
  ipHits.set(ip, ipTimestamps);
  globalHits.length = 0;
  globalHits.push(...prunedGlobal, now);

  return { ok: true };
}

export function extractClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anonymous";
}

export function rateLimitResponse(decision: Extract<RateLimitDecision, { ok: false }>) {
  const scopeLabel = decision.scope === "ip" ? "por IP" : "global";
  return Response.json(
    {
      ok: false,
      error: "rate_limit",
      scope: decision.scope,
      retry_after_seconds: decision.retryAfterSeconds,
      message: `Rate limit ${scopeLabel} alcanzado. Reintenta en ${decision.retryAfterSeconds}s.`,
    },
    {
      status: 429,
      headers: { "Retry-After": String(decision.retryAfterSeconds) },
    },
  );
}
