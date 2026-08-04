#!/usr/bin/env node
// Jira Cloud discovery: dumps the metadata needed to design dashboard queries.
// No dependencies. Needs the Node version in package.json's engines (global fetch).
//
// Usage:
//   JIRA_HOST=your-org.atlassian.net \
//   JIRA_EMAIL=you@example.com \
//   JIRA_TOKEN=xxxxxxxx \
//   node discover.mjs
//
// Create the token at: https://id.atlassian.com/manage-profile/security/api-tokens
// This script is READ-ONLY. It never writes to Jira.

const HOST = process.env.JIRA_HOST;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN;

if (!HOST || !EMAIL || !TOKEN) {
  console.error("Missing env. Set JIRA_HOST, JIRA_EMAIL, JIRA_TOKEN. See header for details.");
  process.exit(1);
}

const AUTH = "Basic " + Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const BASE = `https://${HOST}/rest/api/3`;

async function api(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: AUTH, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${path}\n${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const me = await api("/myself");
  console.log(`\nAuthenticated as: ${me.displayName} <${me.emailAddress}>  (accountId ${me.accountId})`);

  console.log("\n════════ PROJECTS ════════");
  let start = 0;
  const projects = [];
  while (true) {
    const page = await api(`/project/search?startAt=${start}&maxResults=50&expand=insight`);
    projects.push(...page.values);
    if (page.isLast || page.values.length === 0) break;
    start += page.values.length;
  }
  for (const p of projects) {
    console.log(
      `${p.key.padEnd(10)} ${p.projectTypeKey.padEnd(12)} ${(p.style || "").padEnd(8)} ${p.name}`
    );
  }
  console.log(`(${projects.length} projects total)`);

  console.log("\n════════ CUSTOM FIELDS ════════");
  const fields = await api("/field");
  const custom = fields.filter((f) => f.custom);
  for (const f of custom) {
    const type = f.schema?.type || "?";
    const items = f.schema?.items ? `<${f.schema.items}>` : "";
    console.log(`${f.id.padEnd(20)} ${(type + items).padEnd(16)} ${f.name}`);
  }
  console.log(`(${custom.length} custom fields; ${fields.length - custom.length} system fields)`);

  console.log("\n════════ STATUSES ════════");
  const statuses = await api("/status");
  const byCat = {};
  for (const s of statuses) {
    const cat = s.statusCategory?.name || "Unknown";
    (byCat[cat] ||= []).push(s.name);
  }
  for (const [cat, names] of Object.entries(byCat)) {
    console.log(`${cat}: ${[...new Set(names)].sort().join(", ")}`);
  }

  console.log("\n════════ ISSUE TYPES PER PROJECT ════════");
  for (const p of projects) {
    try {
      const detail = await api(`/project/${p.key}?expand=issueTypes`);
      const types = (detail.issueTypes || []).map((t) => t.name).join(", ");
      console.log(`${p.key.padEnd(10)} ${types}`);
    } catch (e) {
      console.log(`${p.key.padEnd(10)} (could not read: ${e.message.split("\n")[0]})`);
    }
  }

  console.log("\nDone. Use the project keys, status names, and issue types above to fill in the teams, scenes, and jira.doneStatuses fields of config.js.\n");
}

main().catch((e) => {
  console.error("\nFailed: " + e.message);
  process.exit(1);
});
