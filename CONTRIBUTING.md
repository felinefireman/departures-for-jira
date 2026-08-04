# Contributing

`npm test` before you push. Sign off with `git commit -s` (DCO, not a CLA).

## The client script is ES5

`src/dashboard.js` emits the whole page as a single template literal. Everything inside the
script block is therefore **deliberately ES5**: `var`, `function(){}`, string concatenation,
and no backticks or interpolation. A backtick there ends the template early; an
interpolation injects something unintended. That's the constraint of living inside a JS
template.

Exactly one interpolation is allowed in that region, `var CFG = ${cfg}`, and everything the
client needs is a property of that object. If you're hand-building JS strings on the
server, put the data in `CFG` instead.

Everything else, including the module-level code in the same file, is modern ESM.

`test/render.test.js` parses `src/dashboard.js` and enforces all of it: no backtick, one
interpolation, no `let`/`const`, and the region still parses.

## Layout

| | |
|---|---|
| `config.js` | the deployer's config; the only file most people touch |
| `src/worker.js` | routing, built from a config by `createWorker` |
| `src/refresh.js` | the chunked refresh cycle and KV storage |
| `src/kpis.js` | config to JQL |
| `src/dashboard.js` | the entire page |
| `src/demo.js` | synthetic snapshot for credential-free runs |
| `demo/` | the demo board's own config and entry point; `npm run demo` |
| `test/fixtures.js` | a second, differently shaped config for tests that need one |
| `tools/config-builder.html` | standalone config form |

No build step: plain JavaScript, bundled by wrangler as-is. `validateConfig` in
`src/config.js` is what catches a bad config, at startup, with every problem listed at once.
It is the only guard on config shape, so a new config field means a new rule there and a new
case in `test/config.test.js`.

## Tests

Four of these exist because the bug they catch shipped once and passed a green suite:

- `render.test.js` reads the *source*, not the rendered output. Rendered HTML can never
  contain an interpolation, so asserting that proves nothing.
- `demo.test.js` compares demo keys against `buildQueries` in both directions. One direction
  let a slug mismatch through that only failed against real Jira.
- `refresh.test.js` drives the cursor across two full sweeps. An arithmetic-only check
  missed a cursor that stopped rotating.
- `worker.test.js` asserts the entry module exports nothing workerd would reject. Neither
  `node --test` nor `wrangler --dry-run` catches that, but the Worker won't boot.
