You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at c542f086866acf38b2ef61173c3056f7211f0fc7 (B1.2 merged as #738)
Branch: feature/ffi-reach/s5-b13-no-resize   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #678

## Your stage
perf(codegen) — a foreign call does not resize an array: resizesArray = false for a declare function (WP40 B1.3)
Goal: Re-derive resizesArray = false for a foreign callee now that no array header crosses to C, so the three effects the design names stop treating a call to C as a possible resize, without touching the checker's index proof
Owns (do not create or edit files outside these globs): the FFI lane: src/** except src/std-modules.ts; runtime/nish.d.ts; runtime/runtime.c, runtime/nish.h, tests/runtime-test.c; tests/cases/ffi_*, tests/cases/panics_ffi_*, tests/cases/reject_ffi_*, tests/run.js, tests/ffi-buffer.js, tests/differential/** (via goldens.js, plus known-failures.txt), tests/self/goldens/** (via goldens.js), tests/wordings/**, tests/panics-oracle.js; docs/LANGUAGE.md, docs/AI.md, docs/IR_COOKBOOK.md, docs/cookbook/decl-ffi*, docs/guide/using-nish/interop.md, docs/security/runtime.md, docs/security/README.md, docs/wp27-ffi.md, docs/wp40-ffi-buffers-handles.md
Verification: npm run check; npm run lint; npm run lint:dead; node tests/run.js ffi; node tests/run.js self; node tests/run.js selfhost; node tests/run.js differential; WASI_SYSROOT=/usr node tests/run.js wasi (read the skip line); node tests/run.js performance; then an undegraded npm test with the skip count no higher than main's
Targeted tests: node tests/run.js <filter>
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/** (node tests/self/goldens.js --update), tests/differential/goldens/** (node tests/differential/goldens.js --update), tests/cases/*.ll (UPDATE_GOLDENS=1 node tests/run.js <case>), the IR_COOKBOOK runtime-prelude block (bash docs/cookbook/regen.sh), CHANGELOG.md (never touched by a PR)

Todos:
- [b13-fact] Set `resizesArray = false` for a foreign callee in src/attributes.ts and rewrite the comment above it (§3c), leaving every other fact in that block, `willReturn = false` included — see docs/wp40-ffi-buffers-handles.md §3c, §9 B1.3, §10 Q3
- [b13-effects] Confirm the three emitter/attribute effects §9's B1.3 row lists move, and nothing in src/bounds.ts or src/ranges.ts does (Q15(a))
- [b13-tests] `ffi_buffer_no_resize` (golden .ll, native round trip, one function per effect) plus the negative pin (a C-calling user function that also resizes keeps its checks); before/after IR for each in the commit body
- [b13-docs] wp40 status line for B1.3; IR_COOKBOOK / security record if they state the fact
- [b13-goldens] Regenerate tests/self/goldens, the differential goldens (register ffi_buffer_no_resize) and any moved .ll with tooling, and read every diff: the only moves are the three effects (and the checked.txt facts line)

Full plan, for context on how your stage fits with the others. Your stage's
detail is in the body sections the todos point to ("— see <Section>"):
  git fetch origin claude/elegant-meitner-wpiki1
  git show origin/claude/elegant-meitner-wpiki1:.claude/plans/ffi-reach.plan.md
Read it. Do not implement anything from another stage — another session owns it
and may be working in parallel right now.

## Stage notes
- B1.1 (#709) and B1.2 (#738, `c542f08`) are merged: a `declare function` takes `u8[]` / `readonly u8[]`, the call lowers to `buf->data` with `len` loaded after every argument, each buffer is checked against its count (`ffi-length`), and the foreign callee's facts say C writes through a `u8[]` (`writesThrough`). **This PR is B1.3 alone**: re-derive `resizesArray = false` for a foreign callee (§10 Q3(a), owner 2026-10-19).
- The block to change is in src/attributes.ts, in the foreign-callee facts (search for "S1's boundary is scalars only, so a C body cannot reach an array header"; it sets `facts.resizesArray = true`, ~line 3617-3621 on main). Rewrite that comment to say why `false` is now right: no header crosses to C after B1.2 (only `buf->data`, lent for the call), so C cannot move a length (§3c). Keep every other line of that block: `willReturn = false` in particular stays (§3c), as do `sharedWrite`, `writesPastParams`, `writesElsewhere`, `readsMemory`.
- **Q15(a) is decided: do not touch the checker's index proof.** `callSummary` (src/bounds.ts) and `noteCall` / `scan.opaque` (src/ranges.ts) stay as they are, so every length fact is still dropped at a foreign call and an index after it keeps its check. If a golden moves in a way that shows a bounds/range change, stop and report it instead of accepting it.
- The three effects, and only these, are what B1.3 moves (§9's B1.3 row is authoritative; the anchors below are at main `c542f08`; find each by content if they have moved):
  1. `emitCompoundElementStore` (src/emit-arrays.ts, the `mayResize(emitter, expr.children[1])` test near :1268) stops re-checking and re-addressing the element when the store's right-hand side calls `read`.
  2. `openHeaderScope` (src/emit-arrays.ts :744-747, through `mayResize`) hoists the header out of a counted loop whose body calls `read`.
  3. `isCountedLoop` (src/attributes.ts ~:5295, through `bodyMayExtend`) counts a `for…of` whose body calls `read`, so the enclosing function's `loopsBounded` becomes true. That never reaches the `.ll` (the foreign `willReturn = false` still takes `willreturn` from the caller); it shows only in the facts line of the `--emit-checked` dump (src/dump.ts), i.e. in tests/self/goldens/checked.txt.
- B1.2's narrow proof (`foreignBufferCountProven` -> `bodyMayExtend` over the arguments after a count) also reads callees' `resizesArray`. A later argument that is itself a foreign call will now be judged non-resizing. Confirm that is sound (C cannot move a length, by the same argument) and say whether any B1.2 golden moves; if one does, explain the move in the commit body. Probe the siblings: a foreign call nested in a later argument, a `new` whose constructor calls C, a user function that calls C and also pushes (it must stay `resizesArray = true` through the fixpoint; its own push, not C, is what sets it).
- Test: `ffi_buffer_no_resize` (golden `.ll` + native round trip with expected stdout), one function per effect, each of whose IR differs from what main emits today. The commit body shows the before and after IR for each of the three functions:
  - `buf[i] += toU8(read(fd, buf, toU64(buf.length)))`, with no second range check after the call;
  - `for (let i = 0; i < buf.length; i++) { read(fd, buf, 1); s += buf[i] }`, with one `len` load before the loop;
  - `for (const b of buf) { read(fd, buf, 1); s += b }`, whose function's line in tests/self/goldens/checked.txt reads `loopsBounded=true` (it reads `false` before B1.3).
  A loop that only *follows* the call is not a test of B1.3 (its IR is the same before and after). Use a sidecar `.c` or a pipe (see how B1.2's `ffi_buffer_read` drives `read`) so the round trip is deterministic.
- Add at least one negative pin: a user function that calls C *and* resizes the array keeps the re-check / per-iteration load (its IR must still show them), so the narrowing cannot be widened silently (CLAUDE.md: "A rule that lets a value outlive its scope pins what it leaves out").
- Docs: wp40's status line for B1.3; docs/IR_COOKBOOK.md if its FFI section describes the re-check after a foreign call; docs/security/runtime.md RT-18 (or a new row) if it states the `resizesArray` fact. No docs/guide change is expected (nothing a user sees), unless a page says a foreign call reloads the length.
- `Measured:`: the counted-loop-with-`read` shape, before and after, with the noise band (CLAUDE.md). Omit the trailer rather than invent a figure.
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
