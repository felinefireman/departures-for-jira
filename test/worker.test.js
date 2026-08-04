import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as entry from "../src/index.js";

// workerd rejects any named export here that isn't a function or handler, and refuses to
// start the Worker. Neither `node --test` nor `wrangler --dry-run` catches it.
describe("worker entry module", () => {
  it("default-exports fetch and scheduled handlers", () => {
    assert.equal(typeof entry.default, "object");
    assert.equal(typeof entry.default.fetch, "function");
    assert.equal(typeof entry.default.scheduled, "function");
  });

  it("exports nothing else that the runtime would reject", () => {
    for (const [name, value] of Object.entries(entry)) {
      if (name === "default") continue;
      assert.equal(typeof value, "function",
        `src/index.js exports "${name}" as ${typeof value}; the Workers runtime accepts only functions or handlers here. Move it to another module.`);
    }
  });
});
