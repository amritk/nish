---
name: net_relay_f64 flake — one scratch directory per relay program
overview: tests/link/net_relay and tests/link/net_relay_f64 run the same checks (tests/link/net_relay/checks.ts), and setup.ts writes the PEM pair the renewal checks watch to the fixed path build/net_relay/{chain,key}.pem. The link pool runs both programs at once, so each one's writes replace the files the other is about to load, and RelayWatch (mtime only) reads the other's writes as a renewal. Give each program its own scratch directory, passed in by its entry, so the two never share a file.
stages:
  - id: s1-scratch-dir
    title: S1 — each relay program writes under its own directory
    goal: net_relay writes only build/net_relay/ and net_relay_f64 writes only build/net_relay_f64/; two instances of the two programs run at once pass every check; the tests/run.js comment that lists the files each link program writes names both directories.
    verification: npm run check && npm run lint && node tests/run.js net_relay
    todos:
      - id: param-dir
        content: relayChecks and setupChecks take the scratch directory as a required parameter (no default); setup.ts builds every path and every expected error string from it — see S1
        status: pending
      - id: entries
        content: tests/link/net_relay/main.ts passes "build/net_relay", tests/link/net_relay_f64/main.ts passes "build/net_relay_f64"; expected.out of both unchanged — see S1
        status: pending
      - id: runjs-comment
        content: The runLinkProgram comment in tests/run.js ("The four that write files write paths named after themselves") names build/net_relay_f64/ too, with the count corrected — see S1
        status: pending
      - id: before-after
        content: Record in the PR body the before/after of the concurrent loop below (before 19/20 iterations failed locally), and the CI runs it explains (43941217022 on main, 44156052604 on a PR) — see S1
        status: pending
---

# net_relay_f64 flake — one scratch directory per relay program

## S1 — each relay program writes under its own directory

Owns: `tests/link/net_relay/setup.ts`, `tests/link/net_relay/checks.ts`,
`tests/link/net_relay/main.ts`, `tests/link/net_relay_f64/main.ts`,
`tests/run.js`. (The plan file stays on the plan branch: `.claude/` is code-owned.)

### Root cause (established before planning)

- CI: run 43941217022 (main, 9d5c50b6, shard 3/8) failed `link/net_relay`
  (6 checks) and `link/net_relay_f64` (2 checks) together; run 44156052604
  (PR branch, shard 3/8) failed `net_relay_f64` alone. Every failing check is in
  setup.ts's PEM/renewal block, `expected true, got false`, and the set differs
  run to run.
- `setup.ts` lines 87–160 write `build/net_relay/chain.pem` and `key.pem`. Both
  programs import it via `checks.ts`. `LINK_SERIAL` does not hold either, and
  `runLinkProgram`'s comment claims every program writes only paths named after
  itself — wrong for net_relay_f64.
- Local reproduction (the built `build/test/link/net_relay_f64/app`, from the
  repo root):
  - alone, 20 runs: 0 failures;
  - two at once, 20 iterations: 19 failed, on exactly the CI checks
    ("a PEM pair on disk is loaded…" 34, "a renewal whose key is not the
    certificate's…" 20, "the finished pair…" 13, "at start-up…" 11,
    "a key file with no P-256 key…" 8).
- Not a race in `std/net` or `runtime/*.c`: `examples/relay/identity.ts` is
  untouched, so no `docs/security/` record changes. No retry, no skip, no
  `LINK_SERIAL` entry (the pool comment says sharing a file is not a reason to
  serialise; it is a reason to stop sharing).

### The change

`relayChecks(dir: string)` and `setupChecks(t, dir)`, no default, so a third
caller cannot share a directory by accident. Every literal
`build/net_relay/...` in setup.ts, the error strings the checks compare
included, is built from `dir`. Check labels and `expected.out` do not change.

### Before/after, run by the worker

```bash
APP=build/test/link/net_relay/app; F64=build/test/link/net_relay_f64/app
for i in $(seq 1 20); do $APP >/tmp/a 2>&1 & $F64 >/tmp/b 2>&1 & wait; grep -h ^FAIL /tmp/a /tmp/b; done
```

(after `node tests/run.js net_relay` has built both apps). Before the change
this prints FAIL lines in most iterations; after it, none. Also loop
`node tests/run.js net_relay_f64` 5 times.

### Out of scope (follow-up, not this PR)

`RelayWatch` compares mtimes only, so a rewrite in the same coarse timestamp
tick as the previous mark would be missed. No observed failure; note it as a
follow-up issue only if the worker confirms it can happen within one program.
