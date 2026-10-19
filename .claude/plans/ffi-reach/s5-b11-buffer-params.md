You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 7a5876459fd8e5b45e72d2a4cfc1ee0a2849e0e8 (S3 merged as #695, #701, #704; the WP40 design merged as #679)
Branch: feature/ffi-reach/s5-b11-buffer-params   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #678

## Your stage
feat(interop) — u8[] and readonly u8[] parameters on declare function, with the run-and-count rule and the refusals (WP40 B1.1)
Goal: A declare function may take u8[] and readonly u8[] parameters, each run of buffers followed by a declared u64 count, with every shape the design refuses pinned by a reject case; the lowering itself is B1.2 and is not this PR
Owns (do not create or edit files outside these globs): the FFI lane: src/** except src/std-modules.ts; runtime/nish.d.ts; runtime/runtime.c, runtime/nish.h, tests/runtime-test.c; tests/cases/ffi_*, tests/cases/panics_ffi_*, tests/cases/reject_ffi_*, tests/run.js, tests/differential/** (via goldens.js, plus known-failures.txt), tests/self/goldens/** (via goldens.js), tests/wordings/**, tests/panics-oracle.js; docs/LANGUAGE.md, docs/AI.md, docs/IR_COOKBOOK.md, docs/cookbook/decl-ffi*, docs/guide/using-nish/interop.md, docs/security/runtime.md, docs/security/README.md, docs/wp27-ffi.md, docs/wp40-ffi-buffers-handles.md
Verification: npm run check; node tests/run.js ffi; node tests/run.js codes; node tests/run.js wordings; node tests/run.js wasi; node tests/run.js performance; then an undegraded npm test with the skip count no higher than main's
Targeted tests: node tests/run.js <filter>
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/** (node tests/self/goldens.js --update), tests/differential/goldens/** (node tests/differential/goldens.js --update), tests/cases/*.ll (UPDATE_GOLDENS=1 node tests/run.js <case>), the IR_COOKBOOK runtime-prelude block (bash docs/cookbook/regen.sh), CHANGELOG.md (never touched by a PR)

Todos:
- [b11-signature] Accept `u8[]` and `readonly u8[]` parameters in `checkForeignSignature` with §3a's run-and-count rule exactly: a run of one or more buffer parameters followed by exactly one `u64` count; `memcpy(dst: u8[], src: readonly u8[], n: u64)` is legal — see docs/wp40-ffi-buffers-handles.md §3a "The pairing rule, exactly", §3b
- [b11-refusals] Every refusal B1.1's row in §9 names, one case file each: reject_ffi_buffer_length_missing, reject_ffi_buffer_length_type, reject_ffi_buffer_element, reject_ffi_buffer_nullable, reject_ffi_buffer_return, reject_ffi_variadic (a rest `...b: u8[]` is still refused as variadic), reject_ffi_callback, reject_ffi_pointer_deref, reject_ffi_asm, reject_ffi_allocator, and reject_ffi_syscall (Q11 is decided (a) for `syscall` alone) — see §8 and §9 B1.1
- [b11-codes] New NL codes for new wordings, retired ones listed in tests/wordings/unreachable.txt, RULE_COUNT kept right — see how S3.1–S3.3 did it
- [b11-docs] LANGUAGE.md "Calling C" (what is accepted now, and that a call to such a declaration is not yet lowered if B1.2 has not landed — or refuse the call site until B1.2, whichever keeps main sound and honest; say which in the PR), AI.md, the interop guide page, wp40's status line for B1.1
- [b11-goldens] Regenerate tests/self/goldens and the differential goldens with tooling and read both diffs

Full plan, for context on how your stage fits with the others. Your stage's
detail is in the body sections the todos point to ("— see <Section>"):
  git fetch origin claude/elegant-meitner-wpiki1
  git show origin/claude/elegant-meitner-wpiki1:.claude/plans/ffi-reach.plan.md
Read it. Do not implement anything from another stage — another session owns it
and may be working in parallel right now.

## Stage notes
- The design is merged: docs/wp40-ffi-buffers-handles.md on main. Read §1, §3 (all of it), §5, §6, §8, §9 and §10 before writing code. The owner took **every recommended answer in §10**: Q1(b), Q2(a), Q3(a) in B1.3, Q4(a), Q5(a), Q6(a), Q7(a), Q8(b), Q9(A), Q10(a), Q11 (a) for `syscall` alone and (b) for the rest, Q12(a), Q13(a), Q14(a), Q15(a). Mark §10's "Decided" column accordingly in this PR (each row: "Decided: <option> (owner, 2026-10-19)").
- **This PR is B1.1 only** (the signature rule and the refusals). B1.2 (lowering, the `ffi-length` panic, the facts through `noteSlotWrite`, wasm checks) and B1.3 (`resizesArray`) are separate PRs by separate sessions after this one merges. Do not start them. Main must stay sound at your head: if a `u8[]` foreign parameter is accepted by the checker before B1.2 lowers it, a program could compile to wrong code. So either (i) refuse a *call* to such a declaration with a clear "not yet lowered" diagnostic that B1.2 removes, or (ii) fold the minimal correct lowering in. Prefer (i); say which you chose and why in the PR body.
- Every refusal is pinned by its own reject case, with its exact message in the .err. The design's §6/§8 list is the checklist; a reviewer will probe each sibling way in (CLAUDE.md: "A checker rule covers every way in").
- Rolling freeze: src/ must not use the new feature in its own source.
- `syscall` refusal: by name, in `checkForeignSignature`, per Q11(a).
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
