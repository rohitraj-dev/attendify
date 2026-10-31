const CACHE_VERSION = "attendify-v2";
const PRECACHE = `${CACHE_VERSION}-precache`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PRECACHE_ICONS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      cache.addAll(PRECACHE_ICONS).then(() =>
        fetch("/offline", { cache: "reload" }).then((response) => {
          if (!response.ok) {
            return;
          }

          return response
            .clone()
            .text()
            .then((body) => {
              if (body.trim().length > 0) {
                return cache.put("/offline", response);
              }
            });
        })
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PRECACHE && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.hostname.includes("supabase")
  ) {
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() =>
          caches
            .match("/offline", {
              ignoreVary: true,
              ignoreSearch: true,
            })
            .then(
              (cached) =>
                cached ??
                new Response(
                  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>You're offline</title>
  </head>
  <body style="margin:0;background:#1a1a1a;color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <main style="box-sizing:border-box;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center">
      <div style="width:100%;max-width:28rem">
        <div style="width:56px;height:56px;margin:0 auto;border-radius:16px;background:#fff;color:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700">A</div>
        <h1 style="margin:32px 0 0;font-size:30px;line-height:1.2">You're offline</h1>
        <p style="margin:12px 0 0;color:rgba(255,255,255,.65);font-size:16px;line-height:1.75">Reconnect to see your attendance.</p>
        <button type="button" onclick="location.reload()" style="margin-top:32px;min-height:44px;padding:0 20px;border:0;border-radius:8px;background:#fff;color:#1a1a1a;font-size:14px;font-weight:600;cursor:pointer">Retry</button>
      </div>
    </main>
  </body>
</html>`,
                  {
                    status: 200,
                    headers: {
                      "Content-Type": "text/html",
                    },
                  }
                )
            )
        )
    );
  }
});
