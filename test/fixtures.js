// A second, differently shaped config for tests that need more than one: two spotlights,
// eight teams, non-empty darkTextAreas, two done statuses. Doubles as the multi-spotlight
// fixture for the scene-targeting tests in render.test.js and config.test.js.
export default {
  brand: {
    name: "Fixture Co",
    glyph: "◆",
    sub: "TEST PULSE",
    footer: "Fixture Co",
  },

  jira: {
    doneStatuses: ["Done", "Resolved"],
    bugIssueType: "Bug",
  },

  teams: [
    { name: "Alpha",   area: "North", keys: ["ALF"] },
    { name: "Bravo",   area: "North", keys: ["BRV"] },
    { name: "Charlie", area: "North", keys: ["CHR"] },
    { name: "Delta",   area: "South", keys: ["DLT"] },
    { name: "Echo",    area: "South", keys: ["ECO"] },
    { name: "Foxtrot", area: "South", keys: ["FXT"] },
    { name: "Golf",    area: "East",  keys: ["GLF"] },
    { name: "Hotel",   area: "East",  keys: ["HTL"] },
  ],

  areaColors: {
    North: "#0039A6",
    South: "#FF6319",
    East:  "#FCCC0A",
  },
  darkTextAreas: ["East"],

  goals: { weeklyShipped: 20 },

  display: {
    rotateMs: 15000,
    pollMs: 120000,
    racePageSize: 5,
    flowWeeks: 4,
    timeZone: "America/Chicago",
    locale: "en-US",
  },

  scenes: [
    { type: "momentum" },
    { type: "flow" },
    { type: "race" },
    { type: "backlogHealth" },
    { type: "spotlight", name: "Alpha Squad", keys: ["ALS"], sprints: true, bugs: true },
    { type: "spotlight", name: "Beta Squad", keys: ["BES"], sprints: false, bugs: true },
  ],
};
