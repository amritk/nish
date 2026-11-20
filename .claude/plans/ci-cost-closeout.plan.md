---
name: Close out ci-cost's follow-up (#1750)
overview: Record criteria 1–3 and the std_postgres_async_pipeline flake on #1750 from measured CI runs, make ci-scope.mjs's why= say whether any lane is off, and land #1757 (Result layout on wasm32) so #1749 and #1732 close.
stages:
  - id: scope-why
    title: "fix(ci): say in ci-scope's why= whether any lane is off"
    goal: scripts/ci-scope.mjs's why= (GITHUB_OUTPUT, step summary and stdout) names the lanes that are off when any is, and says every lane runs when none is and no full-run reason applies; a tests/run.js ci-scope check pins both cases; no lane's read set changes.
    verification: node tests/run.js ci-scope && npm run check && npm run lint
    todos:
      - id: why-text
        content: In emit() (scripts/ci-scope.mjs), when `full` is null derive the message from `lanes` — some off → "lanes off: <names>; every changed path of each is on its allowlist of paths it does not read"; none off → "every lane reads a changed path" — keep it one line — see scope-why
        status: pending
      - id: why-test
        content: Add a check to the ci-scope section of tests/run.js that runs scripts/ci-scope.mjs --files on a docs-only list (some lanes off) and on a src/ path that turns lanes on without a full reason, and asserts the why= line for each, by output, not by message elsewhere — see scope-why
        status: pending
      - id: why-docs
        content: Update any doc that quotes the old why= text (grep docs/, .claude/, AGENTS.md); if none, say so in the PR body — see scope-why
        status: pending
  - id: land-1757
    title: "fix(codegen): lay a Result's pointer payload out in 4 bytes on wasm32"
    goal: PR #1757 (branch fix/result-layout-wasm32) merges main, regenerates its generated files, passes every required check on its new head and is ready to squash-merge; its body carries no session link.
    verification: node tests/run.js wasm32-layout && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && npm run check && npm run lint
    todos:
      - id: sync
        content: Run `npm run sync-main` on fix/result-layout-wasm32, resolve the docs/wp48-ref32-classes.md §4 conflict keeping both main's text and the PR's past-tense wasm32 row, let the goldens regenerate — see land-1757
        status: pending
      - id: verify
        content: Re-run the PR's own checks after the merge (wasm32-layout, performance, wasi with its skip line read, nish-cmp against the seed), add DECLARED entries if any corpus IR now moves — see land-1757
        status: pending
      - id: body
        content: Update the PR body for the merged head (local runs re-measured), and drop its session-link footer, which CLAUDE.md forbids — see land-1757
        status: pending
---

# Close out ci-cost's follow-up (#1750)

Two code stages. The measurement and the flake check were done before the
plan (read-only, from the GitHub API) and are recorded on #1750 by the lead,
not by a stage.

Found before planning:

- **Criteria 1–3, 9-shard era (after #1797), 26 green `ci.yml` PR runs with
  `scope` and `ci-gate`:** median max/median shard ratio 1.21 (lane-on 1.21,
  n=23; lane-off 1.27, n=3); median wall 10.9 min (lane-on 10.9, lane-off
  10.6); median runner-minutes 120.7 overall, **127.0 lane-on** (the
  criterion is `< 127`), 75.4 lane-off. The ratio passes, so no refit of
  `tests/shard-costs.json`.
- **Flake:** 163 `ci.yml` runs since af59ebed (137 PR, 26 push), 81 failed
  test jobs read in full: `link/std_postgres_async_pipeline` failed in none.

## scope-why

Owns: `scripts/ci-scope.mjs`, `tests/run.js` (the `ci-scope` section only),
`docs/wp10-ci.md`.

Only the message changes. No lane's read set, allowlist or command list
changes; if one turns out to, it needs a per-command test in
`node tests/run.js ci-scope` (CLAUDE.md, "A CI lane reads what its commands
read") and the PR says so.

## land-1757

Owns: the files #1757 already changes — `docs/wp48-ref32-classes.md`,
`src/attributes.ts`, `src/debug.ts`, `src/emit-result.ts`, `src/emit.ts`,
`src/interop-abi.ts`, `src/result.ts`, `tests/perf-baseline.json`,
`tests/run.js` (the `wasm32-layout` section only), `tests/nish-cmp.js`
(DECLARED entries only) — plus the generated globs.

Branch: `fix/result-layout-wasm32`, the PR's existing branch (not a
`feature/` branch). Merging main conflicts in `docs/wp48-ref32-classes.md`
and three checked goldens. The goldens are regenerated, never hand-merged.

**Shared file:** both stages edit `tests/run.js`, in different sections.
They develop at once; whichever merges second must be `mergeable` at its
own head before its gate, and goes back to its worker if not.
