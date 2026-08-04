import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../src/config.js";
import config from "../config.js";
import fixtureConfig from "./fixtures.js";

const spotlight = (patch) => (c) => {
  c.scenes = c.scenes.map(s => (s.type === "spotlight" ? { ...s, ...patch } : s));
};

const REJECTS = [
  ["team area missing from areaColors", c => { c.teams = [{ name: "Bad", area: "Mars", keys: ["MARS"] }]; }, /Mars/],
  ["lowercase project key", c => { c.teams[0].keys = ["sales"]; }, /sales/],
  ["duplicate key across teams", c => { c.teams[0].keys.push(c.teams[1].keys[0]); }, /appears in both/],
  ["empty teams", c => { c.teams = []; }, /teams/],
  ["empty scenes", c => { c.scenes = []; }, /scenes/],
  ["unknown scene type", c => { c.scenes = [{ type: "garbage" }]; }, /garbage/],
  ["invalid timeZone", c => { c.display.timeZone = "Mars/Gale Crater"; }, /timeZone/],
  ["negative weeklyShipped", c => { c.goals.weeklyShipped = -1; }, /weeklyShipped/],
  ["darkTextAreas with no matching colour", c => { c.darkTextAreas = ["Atlantis"]; }, /Atlantis/],
  ["spotlight with no keys", spotlight({ keys: [] }), /has no keys/],
  ["malformed key in a spotlight, not just a team", spotlight({ keys: ["bad-key!"] }), /bad-key!/],
  ["spotlight name with no alphanumerics", spotlight({ name: "!!!" }), /alphanumeric/],
  ["key shared by a team and a spotlight", c => {
    spotlight({ keys: [c.teams[0].keys[0]] })(c);
  }, /double-counted/],
  ["two spotlights sharing a query prefix", c => {
    c.scenes = [
      { type: "spotlight", name: "Data Core", keys: ["AAA"], sprints: false, bugs: false },
      { type: "spotlight", name: "data (core)", keys: ["BBB"], sprints: false, bugs: false },
    ];
  }, /prefix/],
  ["missing brand", c => { delete c.brand; }, /brand/],
  ["missing jira", c => { delete c.jira; }, /jira/],
  ["missing display", c => { delete c.display; }, /display/],
  ["missing areaColors", c => { delete c.areaColors; }, /areaColors/],
  ["empty doneStatuses", c => { c.jira.doneStatuses = []; }, /doneStatuses/],
  ["blank bugIssueType", c => { c.jira.bugIssueType = ""; }, /bugIssueType/],
  ["flowWeeks zero", c => { c.display.flowWeeks = 0; }, /flowWeeks/],
  ["flowWeeks negative", c => { c.display.flowWeeks = -3; }, /flowWeeks/],
  ["flowWeeks fractional", c => { c.display.flowWeeks = 2.5; }, /flowWeeks/],
  ["flowWeeks over the cap", c => { c.display.flowWeeks = 500; }, /at most 12/],
  ["racePageSize zero", c => { c.display.racePageSize = 0; }, /racePageSize/],
  ["rotateMs zero", c => { c.display.rotateMs = 0; }, /rotateMs/],
  ["pollMs zero", c => { c.display.pollMs = 0; }, /pollMs/],
  ["two non-spotlight scenes of the same type", c => { c.scenes = [{ type: "momentum" }, { type: "momentum" }]; }, /repeatable/],
  ["blank brand.sub", c => { c.brand.sub = ""; }, /brand\.sub/],
  ["missing brand.footer", c => { delete c.brand.footer; }, /brand\.footer/],
  ["non-string brand.name", c => { c.brand.name = 42; }, /brand\.name/],
  ["non-string brand.glyph", c => { c.brand.glyph = 9; }, /brand\.glyph/],
  ["an areaColors value that is not a colour", c => { c.areaColors.Product = "red;position:fixed;top:0"; }, /areaColors/],
  ["a null areaColors value", c => { c.areaColors.Product = null; }, /areaColors/],
];

describe("validateConfig", () => {
  it("accepts the shipped config", () => {
    validateConfig(config);
  });

  it("accepts the fixture config", () => {
    validateConfig(fixtureConfig);
  });

  for (const [name, mutate, expected] of REJECTS) {
    it(`rejects ${name}`, () => {
      const c = structuredClone(config);
      mutate(c);
      assert.throws(() => validateConfig(c), expected);
    });
  }

  it("reports every problem in one error", () => {
    const c = structuredClone(config);
    c.teams = [{ name: "Bad", area: "Mars", keys: ["lower"] }];
    c.darkTextAreas = ["Atlantis"];
    c.goals.weeklyShipped = 0;
    assert.throws(() => validateConfig(c), (e) => {
      for (const fragment of ["Mars", "lower", "Atlantis", "weeklyShipped"]) {
        assert.ok(e.message.includes(fragment), `omitted "${fragment}":\n${e.message}`);
      }
      return true;
    });
  });
});
