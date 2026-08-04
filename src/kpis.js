import { slugify } from "./slug.js";

function jqlString(s) {
  return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

export function buildQueries(config) {
  const { doneStatuses, bugIssueType } = config.jira;
  const DONE = "(" + doneStatuses.map(jqlString).join(",") + ")";
  const BUG_TYPE = jqlString(bugIssueType);
  const { flowWeeks } = config.display;

  const q = {};

  q.g_open          = "statusCategory != Done";
  q.g_created_30d   = "created >= -30d";
  q.g_completed_30d = "status CHANGED TO " + DONE + " AFTER -30d";
  q.g_completed_prev30d = "status CHANGED TO " + DONE + " AFTER -60d BEFORE -30d";
  q.g_overdue       = "duedate < now() AND statusCategory != Done";
  q.g_due_7d        = "duedate >= now() AND duedate <= 7d AND statusCategory != Done";
  q.g_aging_30d     = "statusCategory != Done AND created <= -30d";
  q.g_aging_60d     = "statusCategory != Done AND created <= -60d";
  q.g_aging_90d     = "statusCategory != Done AND created <= -90d";

  for (let w = 0; w < flowWeeks; w++) {
    const start = (w + 1) * 7;
    const end = w * 7;
    q["flow_created_" + w] =
      "created >= -" + start + "d" + (end > 0 ? " AND created <= -" + end + "d" : "");
    q["flow_completed_" + w] =
      "status CHANGED TO " + DONE + " AFTER -" + start + "d" + (end > 0 ? " BEFORE -" + end + "d" : "");
  }

  const teamKeys = [...new Set(config.teams.flatMap(t => t.keys))];
  for (const key of teamKeys) {
    q["team_" + key + "_open"] = "project = " + key + " AND statusCategory != Done";
    q["team_" + key + "_completed_30d"] =
      "project = " + key + " AND status CHANGED TO " + DONE + " AFTER -30d";
  }

  for (const scene of config.scenes) {
    if (scene.type !== "spotlight") continue;
    const slug = slugify(scene.name);
    const keys = scene.keys.join(",");
    q["spot_" + slug + "_open"] = "project in (" + keys + ") AND statusCategory != Done";
    q["spot_" + slug + "_wip"] = "project in (" + keys + ') AND statusCategory = "In Progress"';
    q["spot_" + slug + "_completed_7d"] = "project in (" + keys + ") AND status CHANGED TO " + DONE + " AFTER -7d";
    q["spot_" + slug + "_completed_30d"] = "project in (" + keys + ") AND status CHANGED TO " + DONE + " AFTER -30d";
    if (scene.sprints) {
      q["spot_" + slug + "_sprint_total"] = "project in (" + keys + ") AND sprint in openSprints()";
      q["spot_" + slug + "_sprint_done"] = "project in (" + keys + ") AND sprint in openSprints() AND statusCategory = Done";
    }
    if (scene.bugs) {
      q["spot_" + slug + "_bugs_open"] = "project in (" + keys + ") AND issuetype = " + BUG_TYPE + " AND statusCategory != Done";
      q["spot_" + slug + "_bugs_closed_7d"] = "project in (" + keys + ") AND issuetype = " + BUG_TYPE + " AND status CHANGED TO " + DONE + " AFTER -7d";
      q["spot_" + slug + "_bugs_created_7d"] = "project in (" + keys + ") AND issuetype = " + BUG_TYPE + " AND created >= -7d";
    }
  }

  return q;
}
