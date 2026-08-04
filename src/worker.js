import { renderDashboard } from "./dashboard.js";
import { validateConfig } from "./config.js";
import { demoSnapshot } from "./demo.js";
import { getSnapshot, isDemo, refreshAndStore } from "./refresh.js";

function keyMatches(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string") return false;
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function createWorker(config) {
  validateConfig(config);

  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      try {
        if (url.pathname === "/health") return json({ ok: true, demo: isDemo(env, url) });

        if (url.pathname === "/api/kpis") {
          const demo = isDemo(env, url);
          if (url.searchParams.get("refresh") === "1") {
            if (demo) return json(demoSnapshot(config));
            if (!env.REFRESH_KEY) {
              return json({ error: "Manual refresh is disabled: set the REFRESH_KEY secret to enable it." }, 403);
            }
            const key = url.searchParams.get("key") || request.headers.get("X-Refresh-Key");
            if (!keyMatches(key, env.REFRESH_KEY)) {
              return json({ error: "Invalid key. Pass ?key= or the X-Refresh-Key header, matching REFRESH_KEY." }, 403);
            }
            return json(await refreshAndStore(env, ctx, config));
          }
          return json(await getSnapshot(env, ctx, config, demo));
        }

        if (url.pathname === "/") return htmlResponse(renderDashboard(config));
        return new Response("Not found", { status: 404 });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : String(e) }, 500);
      }
    },

    async scheduled(_event, env, ctx) {
      ctx.waitUntil(refreshAndStore(env, ctx, config));
    },
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function htmlResponse(s) {
  return new Response(s, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
