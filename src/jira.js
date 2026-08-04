const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRY_AFTER_MS = 5_000;
const ATTEMPTS = 3;

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(seconds, 0) * 1000, MAX_RETRY_AFTER_MS);
  }
  const at = Date.parse(value);
  if (!Number.isNaN(at)) {
    return Math.min(Math.max(at - Date.now(), 0), MAX_RETRY_AFTER_MS);
  }
  return null;
}

export function makeJira(env) {
  const host = env.JIRA_HOST;
  const email = env.JIRA_EMAIL;
  const token = env.JIRA_TOKEN;
  if (!host || !email || !token) {
    throw new Error("Missing JIRA_HOST, JIRA_EMAIL, or JIRA_TOKEN (set JIRA_TOKEN in .dev.vars for `wrangler dev`).");
  }
  const auth = "Basic " + btoa(email + ":" + token);
  const endpoint = "https://" + host + "/rest/api/3/search/approximate-count";

  return {
    async count(jql) {
      let lastErr;
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        let retryAfterMs = null;
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ jql }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          if (res.ok) {
            const data = await res.json();
            return typeof data.count === "number" ? data.count : null;
          }
          const body = await res.text();
          const err = new Error("Jira " + res.status + ": " + body.slice(0, 200));
          if (res.status < 500 && res.status !== 429) {
            err.fatal = true;
            throw err;
          }
          retryAfterMs = parseRetryAfter(res.headers.get("Retry-After"));
          lastErr = err;
        } catch (e) {
          if (e && e.fatal) throw e;
          lastErr = e instanceof Error ? e : new Error(String(e));
        }
        if (attempt < ATTEMPTS - 1) {
          await new Promise(r => setTimeout(r, retryAfterMs ?? 150 * (attempt + 1)));
        }
      }
      throw lastErr;
    },
  };
}

export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const n = Math.min(limit, items.length) || 1;
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}
