// The board the screenshots and the live demo come from. Run it with `npm run demo`:
// synthetic data, no Jira account, no Cloudflare account.
export default {
  brand: {
    name: "DUNDER MIFFLIN",
    glyph: "◆",
    sub: "SCRANTON BRANCH · PAPER PULSE",
    footer: "Dunder Mifflin Paper Company, Inc.",
  },

  jira: {
    doneStatuses: ["Done", "Shipped"],
    bugIssueType: "Bug",
  },

  teams: [
    { name: "Sales",            area: "Sales",      keys: ["SALES", "LEADS"] },
    { name: "Accounting",       area: "Corporate",  keys: ["ACCT"] },
    { name: "Warehouse",        area: "Warehouse",  keys: ["WHSE"] },
    { name: "Quality Assurance", area: "Warehouse", keys: ["QA"] },
    { name: "Customer Service", area: "Sales",      keys: ["CS"] },
    { name: "Human Resources",  area: "Corporate",  keys: ["HR"] },
    { name: "Reception",        area: "Corporate",  keys: ["RECP"] },
    { name: "Party Planning",   area: "Morale",     keys: ["PPC"] },
  ],

  areaColors: {
    Sales:     "#0039A6",
    Warehouse: "#FF6319",
    Corporate: "#00933C",
    Morale:    "#FCCC0A",
  },
  darkTextAreas: ["Morale"],

  goals: { weeklyShipped: 25 },

  display: {
    rotateMs: 15000,
    pollMs: 120000,
    racePageSize: 5,
    flowWeeks: 4,
    timeZone: "America/New_York",
    locale: "en-US",
  },

  scenes: [
    { type: "momentum" },
    { type: "flow" },
    { type: "race" },
    { type: "backlogHealth" },
    { type: "spotlight", name: "Infinity", keys: ["DMI", "WEB"], sprints: true, bugs: true },
  ],
};
