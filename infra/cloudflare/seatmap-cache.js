export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const publicInventory = request.method === 'GET' && /^\/api\/events\/[a-f0-9-]{36}\/seats$/.test(url.pathname)
      && !request.headers.has('authorization') && !request.headers.has('cookie');
    if (!publicInventory) return fetch(request);
    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) return cached;
    const origin = await fetch(request);
    if (origin.status !== 200 || origin.headers.has('set-cookie') || /private|no-store/i.test(origin.headers.get('cache-control') || '')) return origin;
    const headers = new Headers(origin.headers);
    headers.set('Cache-Control', 'public, max-age=2');
    const response = new Response(origin.body, { status: origin.status, statusText: origin.statusText, headers });
    ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  }
};
