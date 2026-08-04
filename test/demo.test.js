import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { demoSnapshot } from "../src/demo.js";
import { buildQueries } from "../src/kpis.js";
import { slugify } from "../src/slug.js";
import config from "../config.js";

describe("demoSnapshot", () => {
  let snap;

  before(() => {
    globalThis.fetch = () => { throw new Error("demo must not fetch"); };
    snap = demoSnapshot(config);
  });

  it("returns demo:true", () => {
    assert.equal(snap.demo, true);
  });

  it("has empty errors", () => {
    assert.deepEqual(snap.errors, {});
  });

  // Both directions: demo must not invent ids, and must not miss any.
  it("demo keys and query ids are the same set", () => {
    const queryIds = [...Object.keys(buildQueries(config))].sort();
    const demoIds = [...Object.keys(snap.values)].sort();
    assert.deepEqual(demoIds, queryIds);
  });

  it("keys stay aligned for awkward spotlight names", () => {
    for (const name of ["Data (Core)", "Ops ", "R&D", "Platform 2.0", "Eng / Infra!"]) {
      const cfg = {
        ...config,
        scenes: config.scenes.map(s => (s.type === "spotlight" ? { ...s, name } : s)),
      };
      const queryIds = [...Object.keys(buildQueries(cfg))].sort();
      const demoIds = [...Object.keys(demoSnapshot(cfg).values)].sort();
      assert.deepEqual(demoIds, queryIds, `key sets diverge for spotlight name ${JSON.stringify(name)}`);
    }
  });

  it("aging is monotonic", () => {
    const { values: v } = snap;
    assert.ok(v.g_aging_30d >= v.g_aging_60d, `aging_30d(${v.g_aging_30d}) < aging_60d(${v.g_aging_60d})`);
    assert.ok(v.g_aging_60d >= v.g_aging_90d, `aging_60d(${v.g_aging_60d}) < aging_90d(${v.g_aging_90d})`);
    assert.ok(v.g_aging_90d >= 0);
  });

  it("aging ≤ open", () => {
    const { values: v } = snap;
    assert.ok(v.g_aging_30d <= v.g_open, `aging_30d(${v.g_aging_30d}) > open(${v.g_open})`);
    assert.ok(v.g_aging_60d <= v.g_open);
    assert.ok(v.g_aging_90d <= v.g_open);
  });

  it("overdue ≤ open", () => {
    assert.ok(snap.values.g_overdue <= snap.values.g_open);
  });

  it("due_7d ≤ open", () => {
    assert.ok(snap.values.g_due_7d <= snap.values.g_open);
  });

  it("MoM delta is positive", () => {
    const { values: v } = snap;
    assert.ok(v.g_completed_30d > v.g_completed_prev30d,
      `completed_30d(${v.g_completed_30d}) <= prev30d(${v.g_completed_prev30d})`);
  });

  it("week-0 completions are at or near the weekly goal", () => {
    const { values: v } = snap;
    assert.ok(v.flow_completed_0 <= config.goals.weeklyShipped,
      `flow_completed_0(${v.flow_completed_0}) > goal(${config.goals.weeklyShipped})`);
    assert.ok(v.flow_completed_0 >= config.goals.weeklyShipped - 5,
      `flow_completed_0(${v.flow_completed_0}) too far below goal(${config.goals.weeklyShipped})`);
  });

  // These render beside each other, so a mismatch is visible on the board.
  it("30-day headlines match the weekly buckets they render beside", () => {
    const { values: v } = snap;
    const weeks = [...Array(config.display.flowWeeks).keys()];
    const expected = 30 / (7 * config.display.flowWeeks);

    for (const [headline, bucket] of [["g_completed_30d", "flow_completed_"], ["g_created_30d", "flow_created_"]]) {
      const weekly = weeks.reduce((s, w) => s + v[bucket + w], 0);
      const ratio = v[headline] / weekly;
      assert.ok(Math.abs(ratio - expected) < 0.2,
        `${headline}=${v[headline]} vs weekly sum ${weekly} (ratio ${ratio.toFixed(2)}, expected ~${expected.toFixed(2)})`);
    }
  });

  it("net 30-day flow is small relative to open work", () => {
    const { values: v } = snap;
    const net = v.g_completed_30d - v.g_created_30d;
    assert.ok(Math.abs(net) < v.g_open,
      `net flow ${net} is not plausible against ${v.g_open} open items`);
  });

  it("all values are non-negative integers", () => {
    for (const [id, n] of Object.entries(snap.values)) {
      assert.ok(Number.isInteger(n) && n >= 0, `${id} = ${JSON.stringify(n)}`);
    }
  });

  it("per-team completions add up to the company headline", () => {
    const { values: v } = snap;
    const teamKeys = [...new Set(config.teams.flatMap(t => t.keys))];
    const teamSum = teamKeys.reduce((s, k) => s + v["team_" + k + "_completed_30d"], 0);
    assert.ok(teamSum <= v.g_completed_30d,
      `team completions ${teamSum} exceed company total ${v.g_completed_30d}`);
  });

  it("spotlight sprint_done ≤ sprint_total", () => {
    const { values: v } = snap;
    for (const scene of config.scenes) {
      if (scene.type !== "spotlight" || !scene.sprints) continue;
      const slug = slugify(scene.name);
      assert.ok(v["spot_" + slug + "_sprint_done"] <= v["spot_" + slug + "_sprint_total"],
        `sprint_done(${v["spot_" + slug + "_sprint_done"]}) > sprint_total(${v["spot_" + slug + "_sprint_total"]})`);
    }
  });

  it("performs no fetch", () => {
    assert.doesNotThrow(() => demoSnapshot(config));
  });
});
