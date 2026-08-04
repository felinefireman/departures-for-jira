import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildQueries } from "../src/kpis.js";
import { slugify } from "../src/slug.js";
import config from "../config.js";
import fixtureConfig from "./fixtures.js";

// tools/config-builder.html is standalone by design, so it carries its own copies of the
// query arithmetic and the slug rule. Copies drift; these pin them to the originals.
const HTML = fs.readFileSync(new URL("../tools/config-builder.html", import.meta.url), "utf8");
const SCRIPT = HTML.slice(HTML.lastIndexOf("<script>") + 8, HTML.lastIndexOf("</script>"));

function lift(name) {
  const start = SCRIPT.indexOf("function " + name + "(");
  assert.notEqual(start, -1, `config-builder.html no longer defines ${name}()`);
  // Walk braces to the end of the declaration.
  let depth = 0;
  let i = SCRIPT.indexOf("{", start);
  const from = i;
  for (; i < SCRIPT.length; i++) {
    if (SCRIPT[i] === "{") depth++;
    else if (SCRIPT[i] === "}" && --depth === 0) break;
  }
  return new Function("return (" + SCRIPT.slice(start, i + 1).replace("function " + name, "function") + ")")();
}

describe("config builder", () => {
  it("has a syntactically valid script", () => {
    assert.doesNotThrow(() => new Function(SCRIPT));
  });

  it("estimates the query count exactly", () => {
    const countQueries = lift("countQueries");
    for (const [label, c] of [["shipped", config], ["fixture", fixtureConfig]]) {
      assert.equal(countQueries(c), Object.keys(buildQueries(c)).length,
        `builder's estimate disagrees with buildQueries for the ${label} config`);
    }
  });

  it("slugifies the same way the worker does", () => {
    const builderSlug = lift("slugify");
    for (const name of ["Engineering", "Data (Core)", "R&D", "Ops ", "Platform 2.0", "!!!", "Eng / Infra!"]) {
      assert.equal(builderSlug(name), slugify(name), `slug mismatch for ${JSON.stringify(name)}`);
    }
  });

  // The tool's whole job is emitting a file that runs. Round-trip a known config through
  // its serialiser and check the text parses back to the same thing.
  it("emits config text that parses back identically", async () => {
    // Everything above the event wiring defines functions without touching the DOM.
    const defs = SCRIPT.slice(0, SCRIPT.indexOf('["bname"'));
    const { serialise } = new Function(defs + "; return { serialise };")();

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "departures-builder-"));
    try {
      for (const [label, c] of [["shipped", config], ["fixture", fixtureConfig]]) {
        const file = path.join(dir, `${label}.js`);
        fs.writeFileSync(file, serialise(c));
        const { default: roundTripped } = await import(`file://${file}?t=${Date.now()}`);
        const { validateConfig } = await import("../src/config.js");
        validateConfig(roundTripped);
        assert.deepEqual(roundTripped, c, `${label} config changed shape through the builder`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the same project-key rule as validateConfig", () => {
    const src = fs.readFileSync(new URL("../src/config.js", import.meta.url), "utf8");
    const inSrc = src.match(/KEY_RE = (\/.*?\/)/)[1];
    const inBuilder = SCRIPT.match(/KEY_RE = (\/.*?\/)/)[1];
    assert.equal(inBuilder, inSrc);
  });

  // "Valid" here is a promise that validateConfig will not reject the config on startup;
  // these pin problems() to the same checks so the two cannot drift apart.
  describe("problems() mirrors validateConfig", () => {
    // Unlike countQueries/slugify, problems() reaches out to module-level KEY_RE and
    // slugify(), so it needs the surrounding defs in scope rather than lift()'s bare body.
    const defs = SCRIPT.slice(0, SCRIPT.indexOf('["bname"'));
    const { problems } = new Function(defs + "; return { problems };")();

    it("accepts the shipped config", () => {
      assert.deepEqual(problems(structuredClone(config)), []);
    });

    it("rejects weeklyShipped <= 0", () => {
      const c = structuredClone(config);
      c.goals.weeklyShipped = 0;
      assert.ok(problems(c).some(m => /weekly goal/i.test(m)));
    });

    it("rejects flowWeeks below 1", () => {
      const c = structuredClone(config);
      c.display.flowWeeks = 0;
      assert.ok(problems(c).some(m => /flow weeks/i.test(m)));
    });

    it("rejects flowWeeks above the 12-week cap", () => {
      const c = structuredClone(config);
      c.display.flowWeeks = 500;
      assert.ok(problems(c).some(m => /cap it at 12/i.test(m)));
    });

    it("rejects racePageSize below 1", () => {
      const c = structuredClone(config);
      c.display.racePageSize = 0;
      assert.ok(problems(c).some(m => /teams per page/i.test(m)));
    });

    it("rejects rotateMs below 1000", () => {
      const c = structuredClone(config);
      c.display.rotateMs = 0;
      assert.ok(problems(c).some(m => /rotate/i.test(m)));
    });

    it("rejects pollMs below 1000", () => {
      const c = structuredClone(config);
      c.display.pollMs = 0;
      assert.ok(problems(c).some(m => /poll/i.test(m)));
    });

    it("rejects two spotlights sharing a query prefix", () => {
      const c = structuredClone(config);
      c.scenes = [
        { type: "spotlight", name: "Data Core", keys: ["AAA"], sprints: false, bugs: false },
        { type: "spotlight", name: "data (core)", keys: ["BBB"], sprints: false, bugs: false },
      ];
      assert.ok(problems(c).some(m => /prefix/i.test(m)));
    });
  });
});
