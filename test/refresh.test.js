import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { refreshAndStore, getSnapshot, CHUNK_SIZE } from "../src/refresh.js";
import { buildQueries } from "../src/kpis.js";
import config from "../config.js";

// Minimal in-memory stand-in for the KPIS binding.
function stubKV() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    snapshot() { return JSON.parse(store.get("snapshot:v1") || "null"); },
    cursor() { return JSON.parse(store.get("refresh:cursor") || "null"); },
  };
}

// Records every query asked for, so an unrequested chunk shows up as a missing id.
function stubEnv(kv, { calls } = { calls: [] }) {
  globalThis.fetch = async (_url, init) => {
    const { jql } = JSON.parse(String(init.body));
    calls.push(jql);
    return new Response(JSON.stringify({ count: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return {
    KPIS: kv,
    JIRA_HOST: "example.atlassian.net",
    JIRA_EMAIL: "you@example.com",
    JIRA_TOKEN: "test-token",
    DEMO: "false",
  };
}

const ctx = { waitUntil() {} };
const ALL_IDS = Object.keys(buildQueries(config));

describe("chunked refresh", () => {
  let kv, calls, env;

  beforeEach(() => {
    kv = stubKV();
    calls = [];
    env = stubEnv(kv, { calls });
  });

  it("refreshes every id within one full sweep", async () => {
    const chunkSize = 5;
    const totalChunks = Math.ceil(ALL_IDS.length / chunkSize);
    for (let i = 0; i < totalChunks; i++) await refreshAndStore(env, ctx, config, chunkSize);

    const snap = kv.snapshot();
    assert.deepEqual(Object.keys(snap.values).sort(), [...ALL_IDS].sort());
  });

  it("keeps rotating, so every id refreshes repeatedly", async () => {
    const chunkSize = 5;
    const totalChunks = Math.ceil(ALL_IDS.length / chunkSize);
    const seen = new Map();

    for (let i = 0; i < totalChunks * 2; i++) {
      const before = calls.length;
      await refreshAndStore(env, ctx, config, chunkSize);
      for (const jql of calls.slice(before)) seen.set(jql, (seen.get(jql) || 0) + 1);
    }

    const queries = buildQueries(config);
    for (const id of ALL_IDS) {
      const count = seen.get(queries[id]) || 0;
      assert.ok(count >= 2, `"${id}" was refreshed ${count}x across two full sweeps`);
    }
  });

  it("clears `partial` once the first sweep completes", async () => {
    const chunkSize = 5;
    const totalChunks = Math.ceil(ALL_IDS.length / chunkSize);

    for (let i = 0; i < totalChunks - 1; i++) {
      const snap = await refreshAndStore(env, ctx, config, chunkSize);
      assert.equal(snap.partial, true, `expected partial after ${i + 1} of ${totalChunks} chunks`);
    }
    const done = await refreshAndStore(env, ctx, config, chunkSize);
    assert.equal(done.partial, undefined, "partial should clear once every id has a value");
  });

  it("wraps a cursor left over from a larger config", async () => {
    await kv.put("refresh:cursor", JSON.stringify({ chunk: 999 }));
    const snap = await refreshAndStore(env, ctx, config, 5);
    assert.ok(Object.keys(snap.values).length > 0, "a stale cursor must not skip every chunk");
    assert.ok(kv.cursor().chunk < Math.ceil(ALL_IDS.length / 5));
  });

  it("restarts from chunk 0 on a corrupt cursor", async () => {
    await kv.put("refresh:cursor", "{not json");
    const snap = await refreshAndStore(env, ctx, config, 5);
    assert.ok(Object.keys(snap.values).length > 0);
    assert.equal(kv.cursor().chunk, 1);
  });

  it("the shipped config refreshes fully in one run", async () => {
    const snap = await refreshAndStore(env, ctx, config);
    assert.ok(ALL_IDS.length <= CHUNK_SIZE,
      `shipped config has ${ALL_IDS.length} queries; more than one chunk means the board updates in stages`);
    assert.equal(snap.partial, undefined);
    assert.deepEqual(Object.keys(snap.values).sort(), [...ALL_IDS].sort());
  });

  it("reports a failed KV write instead of silently serving unstored data", async () => {
    const failing = { ...stubKV(), async put() { throw new Error("KV down"); } };
    const snap = await refreshAndStore(stubEnv(failing), ctx, config, 5);
    assert.equal(snap.stored, false);
  });

  it("clears a stale error once that id refreshes successfully", async () => {
    const failing = new Set([buildQueries(config).g_open]);
    globalThis.fetch = async (_url, init) => {
      const { jql } = JSON.parse(String(init.body));
      if (failing.has(jql)) return new Response("boom", { status: 400 });
      return new Response(JSON.stringify({ count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const first = await refreshAndStore(env, ctx, config);
    assert.ok(first.errors.g_open, "expected the failing id to record an error");

    failing.clear();
    const second = await refreshAndStore(env, ctx, config);
    assert.deepEqual(second.errors, {}, "a successful refresh must clear the previous error");
    assert.equal(second.values.g_open, 1);
  });

  it("single-flights N concurrent cold getSnapshot calls into exactly one refresh", async () => {
    const waits = [];
    const waitingCtx = { waitUntil(p) { waits.push(p); } };
    const results = await Promise.all(
      Array.from({ length: 10 }, () => getSnapshot(env, waitingCtx, config, false)));
    await Promise.all(waits);

    for (const r of results) assert.equal(r.pending, true);
    const expected = Math.min(ALL_IDS.length, CHUNK_SIZE);
    assert.equal(calls.length, expected,
      `expected one refresh sweep (${expected} queries), got ${calls.length} Jira calls`);
  });
});
