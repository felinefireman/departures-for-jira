import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderDashboard } from "../src/dashboard.js";
import config from "../config.js";

const SOURCE = fs.readFileSync(new URL("../src/dashboard.js", import.meta.url), "utf8");

// Rendered HTML never has ${...} left in it, so check the source instead. Script region
// must stay ES5 — see CONTRIBUTING.md.
function clientScriptSource() {
  const open = SOURCE.search(/^<script>$/m);
  const close = SOURCE.search(/^<\/script>$/m);
  assert.ok(open !== -1, "could not locate an opening script tag at the start of a line");
  assert.ok(close > open, "could not locate a closing script tag after the opening one");
  return SOURCE.slice(open + "<script>".length, close);
}

function sectionsOf(html) {
  return [...html.matchAll(/<section id="scene-([a-z]+)" class="scene (sc-[A-Za-z]+)"><\/section>/g)]
    .map(m => ({ id: m[1], cls: m[2] }));
}

describe("client script region", () => {
  const region = clientScriptSource();

  it("contains no backtick", () => {
    const hits = region.match(/`/g) || [];
    assert.equal(hits.length, 0,
      `client script contains ${hits.length} backtick(s): it must stay ES5 string concatenation`);
  });

  // CFG is the only injection point. A second one means hand-built JS crept back in.
  it("contains exactly one interpolation, and it is CFG", () => {
    const hits = region.match(/\$\{[^}]*\}/g) || [];
    assert.deepEqual(hits, ["${cfg}"],
      `expected only \${cfg}; found ${JSON.stringify(hits)}`);
  });

  it("declares with var, never let or const", () => {
    const modern = region.match(/(^|[^\w.])(let|const)\s+[A-Za-z_$]/g) || [];
    assert.equal(modern.length, 0, `found ES6 declarations: ${JSON.stringify(modern)}`);
  });

  it("parses once CFG is substituted", () => {
    const runnable = region.replace("${cfg}", JSON.stringify(config));
    assert.doesNotThrow(() => new Function(runnable));
  });

  // Hardcoded fill target = second spotlight overwrites the first. Happened once already.
  it("never hardcodes a fill target", () => {
    const hits = region.match(/fill\("scene-/g) || [];
    assert.equal(hits.length, 0, `client script hardcodes a fill target: ${JSON.stringify(hits)}`);
  });

  // Spotlight "A" slugifies to "a" — same as scene 0's id. A shared map let the slug win
  // and sent ?scene=a to the wrong scene.
  it("keeps scene ids and spotlight slugs in separate maps, ids first", () => {
    assert.equal(region.match(/slugIdx\[s\.id\]/g), null,
      "scene ids must not be written into the slug map");
    const idAt = region.indexOf("idIdx[raw]");
    const slugAt = region.indexOf("slugIdx[raw]");
    assert.ok(idAt !== -1 && slugAt !== -1, "both lookups must exist");
    assert.ok(idAt < slugAt, "a spotlight slug must not shadow a scene id");
  });
});

describe("renderDashboard", () => {
  const html = renderDashboard(config);

  it("leaves no unevaluated interpolation in the output", () => {
    assert.equal(html.match(/\$\{/g), null, "rendered HTML still contains ${");
  });

  it("generates one correctly classed section per configured scene, each with a unique id", () => {
    const sections = sectionsOf(html);
    assert.equal(sections.length, config.scenes.length);
    assert.equal(new Set(sections.map(s => s.id)).size, sections.length, "scene ids must be unique");
    sections.forEach((s, i) => {
      assert.equal(s.cls, "sc-" + config.scenes[i].type,
        `section ${i} (id scene-${s.id}) has class ${s.cls}, expected sc-${config.scenes[i].type}`);
    });
  });

  it("two spotlights each get their own populated target, with no source change", () => {
    const extended = {
      ...config,
      scenes: [...config.scenes, { type: "spotlight", name: "Platform", keys: ["PLAT"], sprints: false, bugs: true }],
    };
    const sections = sectionsOf(renderDashboard(extended));
    assert.equal(sections.length, extended.scenes.length);
    assert.equal(new Set(sections.map(s => s.id)).size, sections.length, "scene ids must be unique");
    const spotlightSections = sections.filter(s => s.cls === "sc-spotlight");
    assert.equal(spotlightSections.length, 2, "both spotlights should have their own sc-spotlight section");
  });

  it("survives a spotlight name containing quotes and backslashes", () => {
    const nasty = {
      ...config,
      scenes: config.scenes.map(s => s.type === "spotlight" ? { ...s, name: 'Ops "Core" \\ Edge' } : s),
    };
    const out = renderDashboard(nasty);
    const script = out.slice(out.indexOf("<script>") + "<script>".length, out.lastIndexOf("</script>"));
    assert.doesNotThrow(() => new Function(script), "author-supplied name broke the client script");
  });

  it("renders brand strings from config", () => {
    assert.ok(html.includes(config.brand.name), "brand name missing");
    assert.ok(html.includes(config.brand.footer), "brand footer missing");
  });

  // JSON.stringify doesn't escape "<" — unescaped, a config string could close the script tag.
  it("neutralises a brand string that tries to close the script element", () => {
    const hostile = {
      ...config,
      brand: { ...config.brand, name: "ACME</script><script>window.pwned=1</script>" },
    };
    const out = renderDashboard(hostile);
    assert.equal((out.match(/<\/script>/g) || []).length, 1,
      "a config string broke out of the script element");
    assert.ok(out.includes("\\u003c/script>"), "CFG should escape < as \\u003c");
    const script = out.slice(out.indexOf("<script>") + "<script>".length, out.lastIndexOf("</script>"));
    assert.doesNotThrow(() => new Function(script));
  });

  it("escapes brand strings on their way into the markup", () => {
    const hostile = {
      ...config,
      brand: { ...config.brand, footer: "<img src=x onerror=alert(1)>" },
    };
    const out = renderDashboard(hostile);
    assert.ok(!out.includes("<img src=x"), "brand footer injected raw markup");
    assert.ok(out.includes("&lt;img src=x onerror=alert(1)&gt;"), "expected the footer escaped");
  });
});
