---
name: WP19 — stage0 retirement, output stems from package-relative names
overview: Stage0 is deleted and 0.7.0 shipped without it. The one open item is making a package module's output file stem come from its package-relative name so stems no longer depend on the install location; it is deferred.
spec: docs/wp19-stage0-retirement.md
priority: 80
labels: [deferred]
issue: 1874
stages:
  - id: s2-output-stems
    title: WP19 S2 — output file stems taken from package-relative names
    goal: Compilation.outputStems derives a package module's stem from its package-relative name, so emitted file names and IR do not depend on where the package is installed.
    verification: node tests/run.js link && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    status: pending
    labels: [deferred]
    issue: 1885
    todos:
      - id: s2-stem-rule
        content: Specify the package-relative stem rule and how it stays distinct from the existing _n suffix in docs/wp19-stage0-retirement.md section 5a item 5 — see WP19 S2 — output file stems taken from package-relative names
        status: pending
      - id: s2-outputstems
        content: Change Compilation.outputStems in src/compilation.ts to take a package module's stem from its package-relative name, keeping the _n suffix for a collision — see WP19 S2 — output file stems taken from package-relative names
        status: pending
      - id: s2-tests
        content: Add a tests/link case with the same package installed at two paths that must emit identical file names, with expected output — see WP19 S2 — output file stems taken from package-relative names
        status: pending
      - id: s2-goldens
        content: Regenerate tests/self/goldens/checked and run tests/nish-cmp.js, adding DECLARED entries for any corpus IR that moves — see WP19 S2 — output file stems taken from package-relative names
        status: pending
---

# WP19 — stage0 retirement, output stems from package-relative names

## Context
Stage0 was deleted in #150 and 0.7.0 is the first release without it; see [the design note](../../docs/wp19-stage0-retirement.md). One box is left and it is deferred. No GitHub issue is assigned to this plan.

## WP19 S2 — output file stems taken from package-relative names
Spec: [design note §5a item 5](../../docs/wp19-stage0-retirement.md) (`outputStems` under `-o <dir>/`).
Two modules whose paths differ only by a climb or a link used to share one output stem; since #198 the later module gets `<stem>_<n>`. Taking a package module's stem from its package-relative name, which would make stems independent of the install location, is still open. That also keeps the working directory out of emitted names, which the note ties to reproducible builds. This changes `src/`, so it follows the rolling freeze and the `wasi` and `performance` runs in CLAUDE.md.
Likely files: `src/compilation.ts` (`outputStems`, near line 4703), `tests/link/`, `tests/self/goldens/checked/`.
