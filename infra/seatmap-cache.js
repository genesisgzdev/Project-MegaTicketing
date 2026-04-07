export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/seatmap/")) {
      const cache = caches.default;
      let response = await cache.match(request);

      if (!response) {
        response = await fetch(request);
        if (response.status === 200) {
          const newHeaders = new Headers(response.headers);
          newHeaders.set("Cache-Control", "public, max-age=2");
          response = new Response(response.body, { ...response, headers: newHeaders });
          ctx.waitUntil(cache.put(request, response.clone()));
        }
      }
      return response;
    }
    return fetch(request);
  }
};
