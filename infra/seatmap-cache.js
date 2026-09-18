export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const publicInventory = request.method === 'GET' && /^\/api\/events\/[a-f0-9-]{36}\/seats$/.test(url.pathname)
      && !request.headers.has('authorization') && !request.headers.has('cookie');
    if (!publicInventory) return fetch(request);
    const cache = caches.default;
    const origin = await fetch(new Request(request, { cache: "no-store" }));
    if (origin.status !== 200 && origin.status !== 304) return origin;
    if (origin.headers.has('set-cookie') || /private|no-store/i.test(origin.headers.get('cache-control') || '')) return origin;
    const generation = origin.headers.get('X-Inventory-Generation');
    if (!generation) return origin;
    const versioned = new Request(`${url.origin}${url.pathname}?inventory=${generation}`, request);
    const cached = await cache.match(versioned);
    if (cached) {
      const hit = new Response(cached.body, cached);
      hit.headers.set('X-Cache-Status', 'HIT');
      hit.headers.set('X-Inventory-Generation', generation);
      return hit;
    }
    const headers = new Headers(origin.headers);
    headers.set('Cache-Control', 'public, max-age=2');
    headers.set('X-Cache-Status', 'MISS');
    headers.set('X-Inventory-Generation', generation);
    const response = new Response(origin.body, { status: origin.status, statusText: origin.statusText, headers });
    ctx.waitUntil(cache.put(versioned, response.clone()));
    return response;
  }
};
