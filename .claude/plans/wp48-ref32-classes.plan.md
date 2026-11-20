---
name: WP48 — 32-bit references for linked classes
overview: Stages 4 and 5 of the compact-class work are open, plus two acceptance follow-ups (the pre-merge sibling.ts measurement, and nish-cmp comparing no compact program). They finish the user-facing ports and the survey of the compiler's and std/'s own classes.
roadmap: docs/roadmap/wp48-ref32-classes.md
spec: docs/wp48-ref32-classes.md
priority: 40
stages:
  - id: s4a-measure-sibling
    title: WP48 S4a — measure ptr-range on sibling.ts on the merged runtime
    goal: §5.4 of the design note records sibling.ts at 400k and 4M with both a median-band and a widest-band verdict taken on main after abbdca8f, replacing the pre-merge figures.
    verification: NISH=build/seed/bin/nish node bench/wp48-refs/range.mjs --rounds 21 --sizes 400000,4000000 && npm run lint
    status: pending
    issue: 1718
    todos:
      - id: s4a-run
        content: Run bench/wp48-refs/range.mjs with 21 rounds at 400000 and 4000000 on current main — see WP48 S4a
        status: pending
      - id: s4a-record
        content: Replace the pre-merge sibling.ts figures in docs/wp48-ref32-classes.md §5.4 with both band verdicts and the command — see WP48 S4a
        status: pending
      - id: s4a-wasi
        content: Confirm node tests/run.js wasi and node tests/run.js performance pass on main and say so in the PR body — see WP48 S4a
        status: pending
  - id: s4b-nish-cmp-compact
    title: WP48 S4b — nish-cmp compares compact programs, and the based ref32 decode runs once
    goal: nish-cmp's IR comparison covers the compact corpus programs (or DECLARED entries name each moved one), and the based-shape debugger decode has been run on a non-linux-gnu target.
    verification: node tests/nish-cmp.js --no-sidecars && node tests/run.js compact && npm run lint
    status: pending
    issue: 1843
    labels: [needs-decision]
    todos:
      - id: s4b-run-nosidecars
        content: Run tests/nish-cmp.js --no-sidecars against the latest release seed and record which compact programs it compares — see WP48 S4b
        status: pending
      - id: s4b-declared
        content: Add DECLARED entries in tests/nish-cmp.js for the IR that stages 2b, 2c and 3 moved, or make CI compare compact programs without sidecars — see WP48 S4b
        status: pending
      - id: s4b-based-decode
        content: Run tools/gdb/ref32.py and tools/lldb/ref32.py on a non-linux-gnu target, and correct the claim that the based override decodes on Linux — see WP48 S4b
        status: pending
  - id: s4-ports
    title: WP48 S4 — the goose tree programs, sibling.ts and the guide's memory page say what the rule picks
    goal: bench/goose tree programs, bench/wp48-refs/sibling.ts and docs/guide's memory page state what the rule picks and when to override it with implements Wide.
    verification: node tests/run.js cli && node docs/check-links.mjs && npm run lint
    status: pending
    todos:
      - id: s4-goose
        content: Update the bench/goose tree programs to rely on the rule and show nish --explain-layout output — see WP48 S4
        status: pending
      - id: s4-sibling
        content: Port bench/wp48-refs/sibling.ts to the rule's default and keep its command in the note — see WP48 S4
        status: pending
      - id: s4-guide
        content: Write the compact-classes section of the guide's memory page (rule, implements Compact, implements Wide, --compact off, --explain-layout) in docs/guide/ — see WP48 S4
        status: pending
  - id: s5-inside-nish
    title: WP48 S5 — which of the compiler's and std/'s own classes the rule picks
    goal: A survey with measurements (self-build peak RSS and time, std/ benches) lists the classes the rule picks and misses in src/ and std/, with implements Compact or Wide added where the measurement disagrees.
    verification: node tests/run.js compact && node tests/run.js explain_layout && node tests/nish-cmp.js && npm run lint
    status: pending
    todos:
      - id: s5-survey
        content: Run nish --explain-layout over src/ and over the nish-cmp corpus's std/ imports and tabulate picked and left-wide classes — see WP48 S5
        status: pending
      - id: s5-measure
        content: Measure the compiler's self-build peak RSS and time and the std/ benches with and without the picks — see WP48 S5
        status: pending
      - id: s5-markers
        content: Add implements Compact or Wide where the measurement disagrees with the rule; in src/ only after the release that ships the markers — see WP48 S5
        status: pending
---

# WP48 — 32-bit references for linked classes

## Context
Stages 1, 2a, 2b, 2c, 3 and 6 and the design are done ([roadmap page](../../docs/roadmap/wp48-ref32-classes.md)); stage 3's rule is being turned on by the /feature run tracked in #1776 (plan `.claude/plans/wp48-s3-rule.plan.md`, not edited here). Open are stages 4 and 5 and two acceptance follow-ups. Spec: [design note](../../docs/wp48-ref32-classes.md).

## WP48 S4a — measure ptr-range on sibling.ts on the merged runtime
Spec: [§5.4](../../docs/wp48-ref32-classes.md#54-stage-1s-runtime-measured). Issue #1718 is this stage: the recorded sibling.ts runs (400k at -2.8% against a 24.8% band, 4M at +1.0% against 15.1%) predate main's in-place array growth (#1697) and RT-58's realloc guard, and the widest-band definition cannot see a regression under about 15%. Run the recorded command once on main, record both band verdicts, and confirm `wasi` and `performance` pass on main (the PR body of the stage 1 merge misreported `src/` as untouched and a local `wasi` run had 49 failures, likely the container's sysroot).
Likely files: `docs/wp48-ref32-classes.md`, `bench/wp48-refs/range.mjs`.

## WP48 S4b — nish-cmp compares compact programs, and the based ref32 decode runs once
Issue #1843 is this stage. Part A: CI's nish-cmp runs with sidecars, where released and HEAD both refuse every `implements Compact` class (NL4020/NL4021), so no compact corpus program's IR is compared; #1782 moved `compact_list`, `compact_copies`, `compact_no_stack`, `perf_padding_compact` and added `compact_tbaa` with no `DECLARED` entry, and stage 2c's entry excuses three programs whole. Part B: the gdb and lldb decode of a based link has never run off Linux, and forcing `based` on Linux does not decode the same chain (`nish_ref_base` is the mapped range there). The rule run in #1776 will move more compact IR, so coordinate with it.
Likely files: `tests/nish-cmp.js`, `.github/workflows/ci.yml`, `tools/gdb/ref32.py`, `tools/lldb/ref32.py`, `docs/wp48-ref32-classes.md`.

### Decision needed
Should CI also compare compact programs in `--no-sidecars` mode, or should `DECLARED` entries cover stages 2b and 2c? Comparing in CI catches future drift but costs a lane; DECLARED entries are cheap but leave the gap. First run `node tests/nish-cmp.js --no-sidecars` against the latest release seed to see what actually differs.

## WP48 S4 — the goose tree programs, sibling.ts and the guide's memory page say what the rule picks
Spec: [§8](../../docs/wp48-ref32-classes.md#8-stages), stage 4. Ports the `bench/goose` tree programs and `bench/wp48-refs/sibling.ts` and writes the guide's memory page section on when to override the rule. A user-facing change, so the `docs/guide/` page moves with it.
Likely files: `bench/goose/tree.ts`, `bench/wp48-refs/sibling.ts`, `docs/guide/` memory page.

## WP48 S5 — which of the compiler's and std/'s own classes the rule picks
Spec: [§8](../../docs/wp48-ref32-classes.md#8-stages), stage 5. Run #1776 covers the holder-only picks and the `P256ProjectivePoint` decision its survey found, and tightens test 3 of the rule; this stage starts from that result and measures the compiler's own classes (AST and type nodes, scopes, call graph) and `std/` classes (`HttpServerRequest`, `JsonTokenizer`, `Deflater`) on a self-build and the std benches. Markers in `src/` wait for the release that ships `implements Compact` and `Wide`.
Likely files: `src/`, `std/`, `docs/wp48-ref32-classes.md`.
