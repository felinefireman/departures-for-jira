# Deploying Departures

The README covers the deploy sequence end to end. This file is the extra depth: cron
tuning, the subrequest cap, and Cloudflare Access.

## Cron

`0 */3 * * *` by default: every three hours, round the clock. Edit `triggers.crons` in
`wrangler.jsonc`.

Each run refreshes one chunk of up to 40 queries and merges it, so worst-case staleness is
`chunks × interval`. The config builder reports how many chunks a config needs; if it's more
than one, shorten the interval. A config that adds teams costs latency, not failure.

## Subrequest cap

Cloudflare's Free plan allows 50 `fetch` subrequests per invocation, and each KPI is one
Jira query. `wrangler dev` does not enforce this, so it only shows up in production, which
is why chunked refresh exists and why `npm test` asserts a chunk stays under the cap.

## Additional security concerns

The Worker is public by default. It exposes counts only and holds no secrets in its output,
but a wallboard is still internal information. Put a custom domain route on it in the
Cloudflare dashboard, then in Cloudflare Zero Trust:

1. Add an Access application scoped to that route.
2. Add a policy allowing your organization's identity provider (Google Workspace, Okta, a
   one-time PIN by email, whatever you already use).
3. Cloudflare handles the login page; the Worker sees only already-authenticated requests.
