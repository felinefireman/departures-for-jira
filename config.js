/**
 * Your board. This is the only file you need to edit.
 *
 * Don't know your project keys or status names? Run `npm run discover` against your
 * Jira, or open tools/config-builder.html and fill in the form.
 */
export default {
  brand: {
    name: "ACME",           // masthead wordmark
    glyph: "◆",             // mark before it; "" for none
    sub: "COMPANY PULSE",   // line under the wordmark
    footer: "Acme Inc",     // footer bar
  },

  jira: {
    // Done-category statuses that mean actually finished. Exclude abandonment ones
    // (Rejected, Won't Do) or throughput reads high.
    doneStatuses: ["Done"],
    bugIssueType: "Bug",
  },

  // Leaderboard rows. Multiple keys per team get summed; `area` groups teams and picks
  // the line colour.
  teams: [
    { name: "Support",     area: "Service",    keys: ["SUP"] },
    { name: "Platform",    area: "Product",    keys: ["PLAT"] },
    { name: "Design",      area: "Product",    keys: ["DES"] },
    { name: "Finance",     area: "Corporate",  keys: ["FIN"] },
    { name: "People",      area: "Corporate",  keys: ["HR"] },
  ],

  // Every `area` needs a colour here. Defaults: NYC subway lines.
  areaColors: {
    Product:   "#0039A6",
    Service:   "#FF6319",
    Corporate: "#00933C",
  },
  darkTextAreas: [],  // areas whose bullet needs black text on a light fill

  goals: { weeklyShipped: 25 },

  display: {
    rotateMs: 15000,
    pollMs: 120000,       // how often a loaded tab re-reads the stored snapshot
    racePageSize: 5,
    flowWeeks: 4,
    timeZone: "America/New_York",
    locale: "en-US",
  },

  // Delete an entry to drop that scene; move it to reorder.
  scenes: [
    { type: "momentum" },
    { type: "flow" },
    { type: "race" },
    { type: "backlogHealth" },
    // Spotlight: pulls a project onto its own card when it doesn't compare like-for-like
    // (e.g. sprints vs ticket queues). No Jira Software boards? sprints:false drops the
    // ring instead of rendering it empty.
    { type: "spotlight", name: "Engineering", keys: ["ENG"], sprints: true, bugs: true },
  ],
};
