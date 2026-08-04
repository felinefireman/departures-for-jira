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
    // Statuses in Jira's Done category that mean genuinely finished. Leave out any you
    // use for abandonment (Rejected, Won't Do), or your throughput will read high.
    doneStatuses: ["Done"],
    bugIssueType: "Bug",
  },

  // The leaderboard. One row per team; a team can own several project keys and their
  // counts are summed. `area` groups teams and picks the line colour.
  teams: [
    { name: "Support",     area: "Service",    keys: ["SUP"] },
    { name: "Platform",    area: "Product",    keys: ["PLAT"] },
    { name: "Design",      area: "Product",    keys: ["DES"] },
    { name: "Finance",     area: "Corporate",  keys: ["FIN"] },
    { name: "People",      area: "Corporate",  keys: ["HR"] },
  ],

  // Every `area` above needs a colour here. Defaults are NYC subway line colours.
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
    // A spotlight pulls projects out of the leaderboard onto their own card, for work that
    // doesn't compare like-for-like with the rest, such as sprint-based delivery sitting
    // next to ticket queues; add as many as you need. Without Jira Software boards, set
    // sprints:false and the ring is dropped rather than left empty.
    { type: "spotlight", name: "Engineering", keys: ["ENG"], sprints: true, bugs: true },
  ],
};
