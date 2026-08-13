#!/usr/bin/env node

const [baseUrl, eventId, seatId, userId, requestCountArg = '40000', concurrencyArg = '1000'] = process.argv.slice(2);
if (!baseUrl || !eventId || !seatId || !userId) {
  console.error('Usage: node scripts/concurrency-check.mjs <base-url> <event-id> <seat-id> <user-id> [requests=40000] [concurrency=1000]');
  process.exit(2);
}

const requestCount = Number(requestCountArg);
const concurrency = Math.min(Number(concurrencyArg), requestCount);
const endpoint = `${baseUrl.replace(/\/$/, '')}/reserve`;
const body = JSON.stringify({ eventId, seatId, userId });
const statuses = new Map();
let cursor = 0;
const startedAt = performance.now();

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= requestCount) return;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': `load-${index}` },
        body,
      });
      statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
      await response.arrayBuffer();
    } catch {
      statuses.set('network-error', (statuses.get('network-error') || 0) + 1);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
const elapsed = performance.now() - startedAt;
const successes = statuses.get(201) || 0;
const conflicts = statuses.get(409) || 0;
const serverErrors = [...statuses.entries()]
  .filter(([status]) => Number.isInteger(status) && status >= 500)
  .reduce((total, [, count]) => total + count, 0);
const safe = successes === 1 && serverErrors === 0;
console.log(JSON.stringify({ endpoint, requestCount, concurrency, elapsedMs: Math.round(elapsed), requestsPerSecond: Math.round(requestCount / (elapsed / 1000)), statuses: Object.fromEntries(statuses), invariant: { exactlyOneAccepted: successes === 1, noServerErrors: serverErrors === 0, safe, accepted: successes, conflicts, serverErrors }, }, null, 2));
if (!safe) process.exitCode = 1;
