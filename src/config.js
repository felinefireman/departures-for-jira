import { slugify } from "./slug.js";

const VALID_SCENE_TYPES = new Set(["momentum", "flow", "race", "backlogHealth", "spotlight"]);
const KEY_RE = /^[A-Z][A-Z0-9_]*$/;
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$/;
const BRAND_FIELDS = ["name", "sub", "footer"];

function isPositiveInteger(n) {
  return typeof n === "number" && Number.isInteger(n) && n >= 1;
}

function isNonEmptyString(s) {
  return typeof s === "string" && s.length > 0;
}

export function validateConfig(config) {
  const errors = [];

  if (!config.brand || typeof config.brand !== "object") {
    errors.push("brand is required");
  } else {
    for (const field of BRAND_FIELDS) {
      if (!isNonEmptyString(config.brand[field])) {
        errors.push(`brand.${field} must be a non-empty string`);
      }
    }
    if (config.brand.glyph !== undefined && typeof config.brand.glyph !== "string") {
      errors.push('brand.glyph must be a string ("" for none)');
    }
  }

  if (!config.jira || typeof config.jira !== "object") {
    errors.push("jira is required");
  } else {
    const { doneStatuses, bugIssueType } = config.jira;
    if (!Array.isArray(doneStatuses) || doneStatuses.length === 0 ||
        !doneStatuses.every(s => typeof s === "string" && s.length > 0)) {
      errors.push("jira.doneStatuses must be a non-empty array of non-empty strings");
    }
    if (typeof bugIssueType !== "string" || bugIssueType.length === 0) {
      errors.push("jira.bugIssueType must be a non-empty string");
    }
  }

  if (!config.areaColors || typeof config.areaColors !== "object") {
    errors.push("areaColors is required");
  } else {
    for (const [area, color] of Object.entries(config.areaColors)) {
      if (!isNonEmptyString(color) || !COLOR_RE.test(color)) {
        errors.push(`areaColors["${area}"] must be a hex colour or a CSS colour name, got ${JSON.stringify(color)}`);
      }
    }
  }

  if (!config.teams || config.teams.length === 0) {
    errors.push("teams must not be empty");
  } else {
    const seenKeys = new Map();
    for (const team of config.teams) {
      if (!config.areaColors || !config.areaColors[team.area]) {
        errors.push(`team "${team.name}" uses area "${team.area}" which is missing from areaColors`);
      }
      for (const key of team.keys) {
        if (!KEY_RE.test(key)) {
          errors.push(`project key "${key}" in team "${team.name}" does not match /^[A-Z][A-Z0-9_]*$/`);
        }
        if (seenKeys.has(key)) {
          errors.push(`project key "${key}" appears in both "${seenKeys.get(key)}" and "${team.name}"`);
        } else {
          seenKeys.set(key, team.name);
        }
      }
    }
  }

  for (const area of config.darkTextAreas || []) {
    if (!config.areaColors || !config.areaColors[area]) {
      errors.push(`darkTextAreas lists "${area}", which is missing from areaColors`);
    }
  }

  if (!config.scenes || config.scenes.length === 0) {
    errors.push("scenes must not be empty");
  } else {
    const teamKeys = new Set((config.teams || []).flatMap(t => t.keys || []));
    const seenTypes = new Set();
    for (const scene of config.scenes) {
      if (!VALID_SCENE_TYPES.has(scene.type)) {
        errors.push(`unknown scene type "${scene.type}"`);
      } else if (scene.type !== "spotlight") {
        if (seenTypes.has(scene.type)) {
          errors.push(`scene type "${scene.type}" appears more than once; only spotlight scenes are repeatable`);
        }
        seenTypes.add(scene.type);
      }
      if (scene.type !== "spotlight") continue;

      const label = scene.name || "<unnamed>";
      if (!scene.keys || scene.keys.length === 0) {
        errors.push(`spotlight "${label}" has no keys`);
        continue;
      }
      if (!scene.name || !slugify(scene.name)) {
        errors.push(`spotlight name ${JSON.stringify(scene.name)} has no alphanumeric characters to build a query id from`);
      }
      for (const key of scene.keys) {
        if (!KEY_RE.test(key)) {
          errors.push(`project key "${key}" in spotlight "${label}" does not match ${KEY_RE}`);
        }
        if (teamKeys.has(key)) {
          errors.push(`project key "${key}" is in both a team and spotlight "${label}": it would be double-counted`);
        }
      }
    }

    const slugs = new Map();
    for (const scene of config.scenes) {
      if (scene.type !== "spotlight" || !scene.name) continue;
      const slug = slugify(scene.name);
      if (slugs.has(slug)) {
        errors.push(`spotlights "${slugs.get(slug)}" and "${scene.name}" both reduce to the query id prefix "spot_${slug}_"`);
      } else {
        slugs.set(slug, scene.name);
      }
    }
  }

  if (!config.display || typeof config.display !== "object") {
    errors.push("display is required");
  } else {
    const d = config.display;
    if (d.timeZone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: d.timeZone });
      } catch {
        errors.push(`display.timeZone "${d.timeZone}" is not a valid IANA time zone`);
      }
    }
    if (!isPositiveInteger(d.flowWeeks)) {
      errors.push("display.flowWeeks must be an integer >= 1");
    } else if (d.flowWeeks > 12) {
      errors.push("display.flowWeeks must be at most 12 (500 weeks is 1028 queries, 26 chunks, 78h to fill)");
    }
    if (!isPositiveInteger(d.racePageSize)) {
      errors.push("display.racePageSize must be an integer >= 1");
    }
    if (!Number.isFinite(d.rotateMs) || d.rotateMs < 1000) {
      errors.push("display.rotateMs must be a number >= 1000");
    }
    if (!Number.isFinite(d.pollMs) || d.pollMs < 1000) {
      errors.push("display.pollMs must be a number >= 1000");
    }
  }

  if (!config.goals || typeof config.goals.weeklyShipped !== "number" || config.goals.weeklyShipped <= 0 || !isFinite(config.goals.weeklyShipped)) {
    errors.push("goals.weeklyShipped must be a positive number");
  }

  if (errors.length > 0) {
    throw new Error("Invalid config:\n" + errors.map(e => "  - " + e).join("\n"));
  }
}
