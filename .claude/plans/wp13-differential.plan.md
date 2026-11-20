---
name: WP13 — differential testing against Node
overview: The native-against-Node oracle runs from frozen rewrites, so every program added after stage0 was removed has no comparison with Node and the fuzzer no longer compares against Node. The one open item is a rewriter driven by stage1's --emit-checked dump; it is deferred and a project of its own.
spec: docs/wp13-differential.md
priority: 80
labels: [deferred]
issue: 1864
stages:
  - id: s2-emit-checked-rewriter
    title: WP13 S2 — a rewriter driven by --emit-checked for programs added after stage0 was removed
    goal: A rewriter typed by stage1's --emit-checked dump produces the JavaScript for programs listed in tests/differential/goldens/unfrozen.txt, so they are compared with Node again and the fuzz comparison with Node is restored.
    verification: node tests/differential/goldens.js && node tests/differential/run.js --quick && npm run lint
    status: pending
    labels: [deferred]
    issue: 1921
    todos:
      - id: s2-scope-note
        content: Write the scope and cut line for the rewriter in docs/wp13-differential.md under "Not in this package", naming which unfrozen programs it must cover first — see WP13 S2 — a rewriter driven by --emit-checked
        status: pending
      - id: s2-rewriter
        content: Add a rewriter to tests/differential/ that reads the --emit-checked dump and applies the rewrite rules table, replacing the hand-frozen store for new programs — see WP13 S2 — a rewriter driven by --emit-checked
        status: pending
      - id: s2-unfreeze
        content: Move programs out of tests/differential/goldens/unfrozen.txt as the rewriter covers them, regenerating with tests/differential/goldens.js --update — see WP13 S2 — a rewriter driven by --emit-checked
        status: pending
      - id: s2-fuzz-node
        content: Restore the fuzz comparison with Node in tests/differential/fuzz.js using the new rewriter — see WP13 S2 — a rewriter driven by --emit-checked
        status: pending
---

# WP13 — differential testing against Node

## Context
Stage 1 landed: the native-against-Node oracle runs from frozen rewrites (`tests/differential/goldens/rewrites.txt`) and the seed-against-HEAD IR fuzzer. See [the design note](../../docs/wp13-differential.md). The one unticked box is deferred; the roadmap page says nothing is scheduled and the note says what would reopen it. No GitHub issue is assigned to this plan.

## WP13 S2 — a rewriter driven by --emit-checked for programs added after stage0 was removed
Spec: [design note, "Not in this package"](../../docs/wp13-differential.md#not-in-this-package).
The original rewriter (`tests/differential/rewrite.js`) was typed by stage0's checker and went with stage0 (#150). Every program added since has no frozen rewrite and so no comparison with Node (`tests/differential/goldens/unfrozen.txt`, 771 lines today), and the fuzz comparison with Node is gone. The note calls the way back "a rewriter typed by stage1's `--emit-checked` dump ... a project of its own", so this stage is deferred. A lead picking it up should first write the scope and cut line, then build the rewriter against the rules table in the note.
Out of scope (roadmap "Not planned"): fuzzing `f64`/`i64` programs and comparing stderr.
Likely files: `tests/differential/` (new rewriter), `tests/differential/goldens.js`, `tests/differential/fuzz.js`, `docs/wp13-differential.md`.
