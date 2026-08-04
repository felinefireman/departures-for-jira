import { makeJira, mapLimit } from "./jira.js";
import { buildQueries } from "./kpis.js";
import { demoSnapshot } from "./demo.js";

const SNAP_KEY = "snapshot:v1";
const CURSOR_KEY = "refresh:cursor";
const LOCK_KEY = "refresh:lock";
const LOCK_TTL_SECONDS = 60;

export const CHUNK_SIZE = 40;
const CONCURRENCY = 6;

export function isDemo(env, url) {
  if (url && url.searchParams.get("demo") === "1") return true;
  return env.DEMO === "true" || !env.JIRA_TOKEN;
}

export async function getSnapshot(env, ctx, config, demo) {
  if (demo) return demoSnapshot(config);

  const cached = await env.KPIS.get(SNAP_KEY);
  if (cached) return JSON.parse(cached);

  ctx.waitUntil(startRefreshOnce(env, ctx, config));
  return { values: {}, errors: {}, pending: true };
}

let refreshInFlight = false;

async function startRefreshOnce(env, ctx, config) {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    const locked = await env.KPIS.get(LOCK_KEY);
    if (locked) return;
    await env.KPIS.put(LOCK_KEY, "1", { expirationTtl: LOCK_TTL_SECONDS });
    await refreshAndStore(env, ctx, config);
  } finally {
    refreshInFlight = false;
  }
}

async function readCursor(env, totalChunks) {
  const raw = await env.KPIS.get(CURSOR_KEY);
  if (!raw) return 0;
  try {
    const { chunk } = JSON.parse(raw);
    return Number.isInteger(chunk) && chunk >= 0 ? chunk % totalChunks : 0;
  } catch (e) {
    console.error("Corrupt refresh cursor, restarting from chunk 0:", e);
    return 0;
  }
}

export async function refreshAndStore(env, ctx, config, chunkSize = CHUNK_SIZE) {
  if (isDemo(env)) return demoSnapshot(config);

  const queries = buildQueries(config);
  const ids = Object.keys(queries);
  const totalChunks = Math.max(1, Math.ceil(ids.length / chunkSize));
  const chunkIdx = await readCursor(env, totalChunks);

  const jira = makeJira(env);
  const values = {};
  const errors = {};
  await mapLimit(ids.slice(chunkIdx * chunkSize, (chunkIdx + 1) * chunkSize), CONCURRENCY,
    async (id) => {
      try {
        values[id] = await jira.count(queries[id]);
      } catch (e) {
        values[id] = null;
        errors[id] = e instanceof Error ? e.message : String(e);
      }
    });

  const prev = await readSnapshot(env);
  const merged = { ...prev.values, ...values };

  const mergedErrors = { ...prev.errors };
  for (const id of Object.keys(values)) delete mergedErrors[id];
  Object.assign(mergedErrors, errors);

  try {
    await env.KPIS.put(CURSOR_KEY, JSON.stringify({ chunk: (chunkIdx + 1) % totalChunks }));
  } catch (e) {
    console.error("Could not advance the refresh cursor; next run repeats this chunk:", e);
  }

  const data = {
    generatedAt: new Date().toISOString(),
    values: merged,
    errors: mergedErrors,
    ...(ids.some(id => !(id in merged)) ? { partial: true } : {}),
  };
  return { ...data, stored: await store(env, data) };
}

async function readSnapshot(env) {
  const raw = await env.KPIS.get(SNAP_KEY);
  if (!raw) return { values: {}, errors: {} };
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Corrupt snapshot, rebuilding from this chunk:", e);
    return { values: {}, errors: {} };
  }
}

async function store(env, data) {
  try {
    await env.KPIS.put(SNAP_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Could not store snapshot:", e);
    return false;
  }
}
