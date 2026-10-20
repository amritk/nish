You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 7611fafbb3bb9302929114ab9c40a0a833d7e6b8 (B1.1 merged as #709)
Branch: feature/ffi-reach/s5-b12-buffer-lowering   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #678

## Your stage
feat(interop) — lower u8[] / readonly u8[] arguments to C, with the per-buffer length check and the ffi-length panic (WP40 B1.2)
Goal: A call to a declare function that takes a buffer compiles and runs: C gets the data pointer, every buffer of a run is checked against its count after all arguments are evaluated, escape analysis and attributes know C writes through a u8[], and NL2554 is gone
Owns (do not create or edit files outside these globs): the FFI lane: src/** except src/std-modules.ts; runtime/nish.d.ts; runtime/runtime.c, runtime/nish.h, tests/runtime-test.c; tests/cases/ffi_*, tests/cases/panics_ffi_*, tests/cases/reject_ffi_*, tests/run.js, tests/differential/** (via goldens.js, plus known-failures.txt), tests/self/goldens/** (via goldens.js), tests/wordings/**, tests/panics-oracle.js; docs/LANGUAGE.md, docs/AI.md, docs/IR_COOKBOOK.md, docs/cookbook/decl-ffi*, docs/guide/using-nish/interop.md, docs/security/runtime.md, docs/security/README.md, docs/wp27-ffi.md, docs/wp40-ffi-buffers-handles.md
Verification: npm run check; npm run lint; node tests/run.js ffi; node tests/run.js panics; node tests/run.js codes; node tests/run.js wordings; WASI_SYSROOT=/usr node tests/run.js wasi (read the skip line); node tests/run.js performance; node tests/run.js differential; then an undegraded npm test with the skip count no higher than main's
Targeted tests: node tests/run.js <filter>
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/** (node tests/self/goldens.js --update), tests/differential/goldens/** (node tests/differential/goldens.js --update), tests/cases/*.ll (UPDATE_GOLDENS=1 node tests/run.js <case>), the IR_COOKBOOK runtime-prelude block (bash docs/cookbook/regen.sh), CHANGELOG.md (never touched by a PR)

Todos:
- [b12-lower] Lower a buffer argument as `buf->data` (`ptr`) and load `len` after every argument has been evaluated; the declare line changes from `%struct.nish_array*` to the §3a ABI — see docs/wp40-ffi-buffers-handles.md §3a
- [b12-check] The `n <= len` check per buffer of a run (unsigned `icmp ule`), the `ffi-length` panic kind with its `--emit-panics` entry, and the narrow proof that elides the check for `toU64(buf.length)` of the same unmodified buffer — see §3a "The proof that elides the check"
- [b12-facts] Foreign argument facts through `noteSlotWrite` (path-aware; nothing for `readonly u8[]`), `writesThrough = true` for a `u8[]` parameter, and the callee's facts entry with `captured = false`; rewrite the comment at src/escape.ts:1524-1527 — see §5
- [b12-lift] Lift NL2554 (retire the code, update the reject cases B1.1 added for it) in the same commit as b12-facts
- [b12-wasm] The `--target wasm32` IR check and the `--profile wasm` link of `ffi_buffer_write` in the `wasi` section — see §5
- [b12-tests] Every case in §9's B1.2 row, by its exact name, including the sidecar `ffi_buffer_read.c`, `ffi_buffer_export_written`'s header/.ll/wasm glue goldens and the three scope-race rejects
- [b12-docs] LANGUAGE.md (the call now lowers; the `ffi-length` panic), AI.md, IR_COOKBOOK entry plus a docs/cookbook/decl-ffi* program, the interop guide page, docs/security/runtime.md, wp40's status line for B1.2
- [b12-goldens] Regenerate tests/self/goldens, the differential goldens (register each new positive case) and every moved .ll with tooling, and read the diffs

Full plan, for context on how your stage fits with the others. Your stage's
detail is in the body sections the todos point to ("— see <Section>"):
  git fetch origin claude/elegant-meitner-wpiki1
  git show origin/claude/elegant-meitner-wpiki1:.claude/plans/ffi-reach.plan.md
Read it. Do not implement anything from another stage — another session owns it
and may be working in parallel right now.

## Stage notes
- B1.1 merged as #709: the checker accepts `u8[]` / `readonly u8[]` parameters with the run-and-count rule and refuses every *call* to such a declaration with NL2554 (`refuseForeignBufferCall`, called from both `checkCall` and `checkDirectCall` in src/expressions.ts). **This PR lowers those calls and lifts NL2554.** Retire NL2554 the way earlier stages retired codes (tests/wordings/unreachable.txt, RULE_COUNT), and delete or repurpose the `reject_ffi_buffer_call*` cases that pinned it: each one that becomes a positive program should become a passing case or be covered by one of the cases below.
- **Constraint recorded by B1.1 (§5):** NL2554 is lifted only together with `writesThrough = true` for a `u8[]` parameter. Never let a call reach C while the callee's facts still say it writes nothing through its arguments: that is the S3.2 shape (a foreign call judged harmless by escape analysis, then a use after free). `readonly u8[]` gets no write fact. The callee's facts entry also carries `captured = false` (C keeps no address past the call).
- The owner took every recommended answer in §10. The ones this stage implements: Q1(b), Q2(a), Q10(a) (load `len` after every argument), Q12(a), Q15(a) (the checker's length facts stay dropped at a foreign call; do not touch src/bounds.ts's `callSummary` or src/ranges.ts's `noteCall`). Q3 is B1.3, not this PR: leave `resizesArray` as it is.
- Read §3a (all of it: the ABI, the late load, the per-buffer check, the unsigned compare, the narrow proof), §5 (facts, escape, the scope races, wasm32 and `--profile wasm`) and §9's B1.2 row before writing code. The B1.2 row is the test list; every case it names ships, with the exact names it gives.
- `ffi-length` is a new panic kind: follow how S3.2 added `ffi-null` end to end (`git grep -l ffi-null`): src/panics.ts, the emitter, tests/panics-oracle.js, tests/run.js, `.panics` goldens, docs/LANGUAGE.md, AI.md, IR_COOKBOOK, the interop guide page, docs/security/runtime.md.
- CLAUDE.md's wasm rule applies directly: "A lowering skipped for wasm32 also covers the freestanding `--profile wasm` route." Both checks in the B1.2 row go in the `wasi` section, and you read its skip line.
- Siblings of every rule you add: the scope-race refusals cover a buffer reached through a field and through an element (the three `reject_ffi_buffer_scope_*race` cases), and probe a constructor reached by `new`, every declarator of a `using`, and `this` leaving a constructor. A reviewer will probe each one.
- Security: docs/security/runtime.md gets rows for the new checks. Its Tests list names each check by its exact `check(...)` string; grep each against tests/run.js before pushing.
- `Measured:` in the commit body: the cost of the per-buffer `n <= len` check on a `write`-or-`read`-shaped loop, proved against unproved, with the noise band as CLAUDE.md describes. If no honest figure exists, leave the trailer out rather than invent one.
- The design's `file:line` anchors are at 7a58764 and B1.1 has moved some of them: find each by its content (e.g. the escape comment is the "C holds none of them past a call either" bullet in src/escape.ts), not by line number.
- Rolling freeze: src/ must not use the feature in its own source.

## First, in this order
1. Read CLAUDE.md, then .claude/orientation.md, then every other .claude/*.md file
   CLAUDE.md tells you to read before the kind of change you are making
   (selfhost.md before src/, typescript.md and comments.md before TypeScript,
   testing.md before tests, licensing.md before copying code). Their rules are
   authoritative.
2. bash scripts/fetch-seed.sh --force   (a stale seed has made clean main fail before).
3. Confirm the toolchain: the SessionStart hook installs LLVM 18; `npm test`'s summary
   must show no DEGRADED banner. Record main's skip count from your first full run
   or from a `node tests/run.js` run on an unmodified checkout, so you can show your
   head's skip count is no higher.

## Definition of done
1. The stage's todos are implemented, and nothing outside your Owns globs changed
   (generated files excepted).
2. `npm run check`, `npm run lint` (read the exit status, never a piped tail),
   `node tests/run.js wasi` (read its skip line; WASI_SYSROOT=/usr if wasi-libc is
   installed) and `node tests/run.js performance` pass. No new NL9007 in src/.
3. An undegraded full `npm test` passes on the head you open the PR from, with a
   skip count no higher than main's. This repo has no coverage tool: its bar is the
   definition of done in CLAUDE.md — a new construct ships a golden .ll, an llvm-as
   pass, a native round trip with expected stdout, at least one negative test, its
   docs/LANGUAGE.md rule, IR_COOKBOOK entry with docs/cookbook/ program, and its
   docs/guide page. Never skip, disable or weaken a test, never raise a ceiling in
   tests/runtime-budgets.js, never edit CI workflows.
4. Before you open the PR, run /check-iterate and fix what it confirms. If that
   command is not available in your session, review your own diff against main
   adversarially yourself and fix what you find — do not skip it. Probe the
   "siblings of the rule" CLAUDE.md names (a constructor reached by `new`, every
   declarator of a `using`, `this` leaving a constructor) for any rule you add.
5. Then run /simplify over the same diff and apply what it returns. If that command
   is not available, re-read your diff for reuse, dead scaffolding and altitude.
   Then run the full suite once, after both passes, not before each.
6. Open a PR from your branch to main, using .github/PULL_REQUEST_TEMPLATE.md's
   sections. Title: a conventional-commit subject that reads as a changelog entry
   (`feat(interop): …`, `feat(std): …`, `docs(interop): …`, `perf(crypto): …`); the
   squash merge lands it, and pr-title.yml checks it. Body: what changed and why,
   the exact LLVM IR for every TypeScript snippet the PR adds to the tests, the
   verification commands you ran with their results (pass/fail/skip counts), and
   `Part of #678`. Commit messages follow CLAUDE.md "Commit messages are the
   changelog" (Measured:/Refs:/Tests: trailers; Measured: carries real figures and
   the noise band). NEVER put session links, model names or platform attributions
   in commits, code or PR text; after the PR opens, read its body back and delete
   any footer a tool appended, or pr-body.yml fails.
7. Do NOT merge your PR, even when CI is green. The run's lead reviews and merges
   it. (This overrides CLAUDE.md's "merge it yourself" for this run only.)

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- The full suite (40–70 min) runs twice: before you open the PR, and when the lead
  says you are next to merge. During review rounds run `node tests/run.js <filter>`
  for what the round changed, plus check and lint; CI runs the full suite on every push.
- Commit before you start a long run, so a stop hook that checks for uncommitted
  work does not wake you while it runs.
- Start a long run once, in the background, with its output redirected to a file,
  then end your turn: you are woken when it exits. Never poll it — no `sleep` or
  `until` loops, no re-armed monitors, never a second run while one is going (they
  share build/). Read the result with grep or tail, not by printing the log.
- Do not schedule check-ins for yourself and do not subscribe to PR activity: the
  lead holds the PR subscription and its messages wake you.
- Do not merge main into your branch whenever it moves. Merge it when the PR
  conflicts, or when the lead tells you you are next to merge — then regenerate the
  generated files with the repo's tooling (never resolve them by hand), run the full
  suite once, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another
  feature/ffi-reach/* branch, never force-push.
- If CI goes red or a test fails, run /debug — reproduce it before you change
  anything. If that command is not available, follow the same order anyway:
  reproduce, localise, one hypothesis at a time, then pin the fix with a test.
- If your stage turns out to be impossible as written, or the design it builds on
  disagrees with the code, push what you have, open the PR as a draft, and say
  exactly what blocked you in the PR body. Do not substitute different work and do
  not widen your scope to fix it.
- You will get review comments as a single batch. Address every blocking one in one
  push, then stop. Non-blocking ones go in that same push when they are cheap; never
  push for them alone. Do not reply to argue; if a finding is wrong, say so in one
  line on that thread and move on.
