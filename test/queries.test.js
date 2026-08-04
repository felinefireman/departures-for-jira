import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildQueries } from "../src/kpis.js";
import { CHUNK_SIZE } from "../src/refresh.js";
import { slugify } from "../src/slug.js";
import config from "../config.js";

describe("buildQueries", () => {
  const queries = buildQueries(config);
  const ids = Object.keys(queries);

  // Constraint is per-chunk, not per-config — chunked refresh lets a config exceed 50
  // queries at the cost of latency. Rotation itself is covered in refresh.test.js.
  it("a single chunk stays under the 50-subrequest cap", () => {
    assert.ok(CHUNK_SIZE < 50, `CHUNK_SIZE is ${CHUNK_SIZE}; a chunk must fit inside 50 subrequests`);
  });

  it("generates stable query ids", () => {
    const ids2 = Object.keys(buildQueries(config));
    assert.deepEqual(ids, ids2);
  });

  it("all query ids are non-empty", () => {
    for (const id of ids) {
      assert.ok(id.length > 0, "empty query id");
    }
  });

  it("all JQL strings contain valid project key references", () => {
    const keyRE = /project\s*(?:=|in)\s*\(?\s*([A-Z][A-Z0-9_]*)/g;
    for (const id of ids) {
      const jql = queries[id];
      if (jql.includes("project")) {
        const matches = [...jql.matchAll(keyRE)];
        for (const m of matches) {
          assert.ok(/^[A-Z][A-Z0-9_]*$/.test(m[1]), `bad key "${m[1]}" in ${id}`);
        }
      }
    }
  });

  // Derived from config, not hardcoded, so renaming the spotlight doesn't break this.
  it("emits a spot_<slug>_ id set for each configured spotlight", () => {
    const spotlights = config.scenes.filter(s => s.type === "spotlight");
    assert.ok(spotlights.length > 0, "shipped config should demonstrate a spotlight");
    for (const s of spotlights) {
      const prefix = "spot_" + slugify(s.name) + "_";
      assert.ok(ids.some(id => id.startsWith(prefix)), `no queries for spotlight prefix "${prefix}"`);
    }
  });

  it("omits sprint queries when a spotlight has sprints disabled", () => {
    const noSprints = {
      ...config,
      scenes: [{ type: "spotlight", name: "Support", keys: ["SUPP"], sprints: false, bugs: false }],
    };
    const got = Object.keys(buildQueries(noSprints));
    assert.ok(!got.some(id => id.includes("_sprint_")), "sprint queries emitted despite sprints:false");
    assert.ok(!got.some(id => id.includes("_bugs_")), "bug queries emitted despite bugs:false");
    assert.ok(got.includes("spot_support_open"), "spotlight should still report open work");
  });

  it("generates flow queries for the configured weeks", () => {
    const flowCreated = ids.filter(id => id.startsWith("flow_created_"));
    assert.equal(flowCreated.length, config.display.flowWeeks);
  });

  it("generates team queries", () => {
    const teamIds = ids.filter(id => id.startsWith("team_"));
    assert.ok(teamIds.length > 0, "no team queries");
  });
});
