import { slugify } from "./slug.js";

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(min, max, rng) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

function sum(xs) {
  return xs.reduce((a, b) => a + b, 0);
}

function apportion(total, weights) {
  const wsum = sum(weights) || 1;
  const exact = weights.map(w => (total * w) / wsum);
  const out = exact.map(x => Math.floor(x));
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  let short = total - sum(out);
  for (let k = 0; short > 0 && order.length; k++, short--) out[order[k % order.length].i]++;
  return out;
}

export function demoSnapshot(config) {
  const rng = mulberry32(42);
  const { flowWeeks } = config.display;

  const v = {};

  const teamKeys = [...new Set(config.teams.flatMap(t => t.keys))];
  const spotlightKeys = config.scenes.flatMap(s => (s.type === "spotlight" ? s.keys : []));
  const projectKeys = [...new Set([...teamKeys, ...spotlightKeys])];

  const p = {};
  for (const key of projectKeys) {
    const open = randInt(12, 48, rng);
    const aging30 = randInt(Math.floor(open * 0.3), Math.floor(open * 0.55), rng);
    const aging60 = randInt(Math.floor(aging30 * 0.45), Math.floor(aging30 * 0.8), rng);
    const aging90 = randInt(Math.floor(aging60 * 0.35), Math.floor(aging60 * 0.75), rng);
    const bugsOpen = randInt(0, 8, rng);
    const bugsClosed7 = randInt(0, Math.max(1, bugsOpen), rng);
    const sprintTotal = randInt(6, 20, rng);
    p[key] = {
      open,
      overdue: randInt(0, Math.floor(open * 0.25), rng),
      due7: randInt(0, Math.floor(open * 0.18), rng),
      aging30,
      aging60,
      aging90,
      wip: randInt(1, Math.max(1, Math.floor(open * 0.4)), rng),
      sprintTotal,
      sprintDone: randInt(1, Math.max(1, sprintTotal - 1), rng),
      bugsOpen,
      bugsClosed7,
      bugsCreated7: Math.max(0, bugsClosed7 + randInt(-1, 2, rng)),
      completed30: 0,
      completed7: 0,
    };
  }

  const weeklyCompleted = [];
  const weeklyCreated = [];
  let weekly = Math.max(1, config.goals.weeklyShipped - randInt(1, 4, rng));
  for (let w = 0; w < flowWeeks; w++) {
    weeklyCompleted[w] = weekly;
    weeklyCreated[w] = Math.max(0, weekly + randInt(-1, 3, rng));
    weekly = Math.max(1, weekly - randInt(0, 3, rng));
  }
  for (let w = 0; w < flowWeeks; w++) {
    v["flow_completed_" + w] = weeklyCompleted[w];
    v["flow_created_" + w] = weeklyCreated[w];
  }

  const scale = 30 / (7 * Math.max(1, flowWeeks));
  v.g_completed_30d = Math.round(sum(weeklyCompleted) * scale);
  v.g_created_30d = Math.round(sum(weeklyCreated) * scale);
  v.g_completed_prev30d = Math.max(1, v.g_completed_30d - randInt(4, 14, rng));

  const openWeights = projectKeys.map(k => p[k].open);
  const per30 = apportion(v.g_completed_30d, openWeights);
  const per7 = apportion(weeklyCompleted[0], openWeights);
  projectKeys.forEach((k, i) => {
    p[k].completed30 = per30[i];
    p[k].completed7 = per7[i];
  });

  for (const key of teamKeys) {
    v["team_" + key + "_open"] = p[key].open;
    v["team_" + key + "_completed_30d"] = p[key].completed30;
  }

  const across = (field) => sum(projectKeys.map(k => p[k][field]));
  v.g_open = across("open");
  v.g_overdue = across("overdue");
  v.g_due_7d = across("due7");
  v.g_aging_30d = across("aging30");
  v.g_aging_60d = across("aging60");
  v.g_aging_90d = across("aging90");

  for (const scene of config.scenes) {
    if (scene.type !== "spotlight") continue;
    const prefix = "spot_" + slugify(scene.name) + "_";
    const over = (field) =>
      sum(scene.keys.map(k => (p[k] ? p[k][field] : 0)));

    v[prefix + "open"] = over("open");
    v[prefix + "wip"] = over("wip");
    v[prefix + "completed_7d"] = over("completed7");
    v[prefix + "completed_30d"] = over("completed30");

    if (scene.sprints) {
      v[prefix + "sprint_total"] = over("sprintTotal");
      v[prefix + "sprint_done"] = Math.min(over("sprintDone"), over("sprintTotal"));
    }
    if (scene.bugs) {
      v[prefix + "bugs_open"] = over("bugsOpen");
      v[prefix + "bugs_closed_7d"] = over("bugsClosed7");
      v[prefix + "bugs_created_7d"] = over("bugsCreated7");
    }
  }

  return { generatedAt: new Date().toISOString(), values: v, errors: {}, demo: true };
}
