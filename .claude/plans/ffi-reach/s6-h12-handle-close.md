You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 9260a2ce1c5d917436c4ea2def576fde1dc41000 (H1.1 merged as #850)
Branch: feature/ffi-reach/s6-h12-handle-close   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #678

## Your stage
feat(codegen) — the owned foreign handle: `using` emits the close at every exit of its block (WP40 H1.2)
Goal: `using f = new File(p)` compiles and runs: the handle class's close runs exactly once on every path out of the block (fall-through, return, break, continue, orReturn, panic, per declarator under Q12(a)), NL2573 is retired, and --deny ffi names the using
Owns (do not create or edit files outside these globs): the FFI lane: src/** except src/std-modules.ts; runtime/nish.d.ts; runtime/runtime.c, runtime/nish.h, tests/runtime-test.c; tests/cases/ffi_*, tests/cases/panics_ffi_*, tests/cases/reject_ffi_*, tests/run.js, tests/ffi-buffer.js, tests/ffi-string.js, a new tests/ffi-handle.js, tests/self/parser-refusals.txt, tests/differential/** (via goldens.js, plus known-failures.txt), tests/self/goldens/** (via goldens.js), tests/wordings/**, tests/panics-oracle.js; docs/LANGUAGE.md, docs/AI.md, docs/IR_COOKBOOK.md, docs/cookbook/decl-ffi*, docs/guide/using-nish/interop.md, docs/security/runtime.md, docs/security/README.md, docs/wp27-ffi.md, docs/wp40-ffi-buffers-handles.md, docs/guide/language/memory.md, docs/cookbook/decl-ffi-handle*, tests/cases/using_*, tests/cases/reject_using_*, tests/cases/ffi_handle_*, tests/cases/reject_ffi_handle_*, tests/cases/caps_ffi_handle*
Verification: npm run check; npm run lint; npm run lint:dead; node tests/run.js ffi; node tests/run.js ffi_handle; node tests/run.js reject_ffi_handle; node tests/run.js using; node tests/run.js caps; node tests/run.js codes; node tests/run.js wordings; node tests/run.js self; node tests/run.js selfhost; node tests/run.js differential; WASI_SYSROOT=/usr node tests/run.js wasi (read the skip line); node tests/run.js performance; diagnostic-coverage --require-coverage --strict-refusals; then an undegraded npm test with the skip count no higher than main's
Targeted tests: node tests/run.js <filter>
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/** (node tests/self/goldens.js --update), tests/differential/goldens/** (node tests/differential/goldens.js --update), tests/cases/*.ll (UPDATE_GOLDENS=1 node tests/run.js <case>), the IR_COOKBOOK runtime-prelude block (bash docs/cookbook/regen.sh), CHANGELOG.md (never touched by a PR)

Todos:
- [h12-close] The emitted close as a fourth kind on `openScope`'s stack, on every exit §4b and §4e list (fall-through, `emitScopeJoins` and its `later` test, `emitScopeExit` including `orReturn()` propagation, the tail-call suppression, panics per §4e) — see docs/wp40-ffi-buffers-handles.md §4b, §4e
- [h12-declarators] Per-declarator opening under Q12(a): each declarator is open before the next initialiser runs, so an exit in a later initialiser closes the earlier handles — see §4e
- [h12-lift] Retire NL2573 in the same commit as the close; `reject_ffi_handle_using` becomes positive coverage
- [h12-ffi] The `ffi` capability offer at the `using`, with `caps_ffi_handle` and `reject_ffi_handle_deny` — see §5
- [h12-arena] `ffi_handle_arena`: a handle object's arena placement and the close's order — see §5
- [h12-wasm] The `--target wasm32` IR check and the `--profile wasm` link of `ffi_handle_file` in the `wasi` section (new tests/ffi-handle.js) — see §5
- [h12-tests] `ffi_handle_file` with its sidecar `.c` counting closes, covering every exit shape §9's H1.2 row lists and H1.1's admit side at run time, plus one case per sibling in the stage notes
- [h12-docs] LANGUAGE.md, AI.md, the interop guide (and memory.md), IR_COOKBOOK with a docs/cookbook/decl-ffi-handle* program, docs/security/runtime.md row with exact check strings, and the wp40 status line
- [h12-goldens] Regenerate tests/self/goldens, the differential goldens (register each new positive case) and every moved .ll with tooling, and read the diffs

Full plan, for context on how your stage fits with the others. Your stage's
detail is in the body sections the todos point to ("— see <Section>"):
  git fetch origin claude/elegant-meitner-wpiki1
  git show origin/claude/elegant-meitner-wpiki1:.claude/plans/ffi-reach.plan.md
Read it. Do not implement anything from another stage — another session owns it
and may be working in parallel right now.

## Stage notes
- H1.1 merged as #850 (`9260a2c`). The checker now knows a handle class (one `readonly` `CPtr`/`CPtr | null` field, written once in the constructor from a `declare function`, read only as `this.f`, and a one-call `[Symbol.dispose]` that is the close, declared once with no modifier). It admits a handle only where §4d allows one. `src/handles.ts` is the handle pass. **Every `using` of a handle class is refused with NL2573 ("not lowered yet").** This PR emits the close and lifts NL2573 in the same commit. Retire NL2573 the way earlier stages retired codes (tests/wordings/unreachable.txt, RULE_COUNT), and turn `reject_ffi_handle_using` into a positive case or cover it with `ffi_handle_file`. H1.1's body lists every handle case and a mutation-sweep table. Read it: `gh` is unavailable, so use `git log -1 9260a2c` for the squash message, and the PR #850 body if your tools reach it.
- **The soundness bar.** Once NL2573 is gone, every handle that is opened is closed exactly once on every path out of its `using` block, and never closed twice. The design lists the exits (§4b, §4e):
  - fall-through;
  - `return` (including `return f(x)` in tail position, where the close must come after the call, so `marksTailCall` must not mark it `tail`);
  - `break` and `continue` out of a loop that contains the block, or inside it;
  - `emitScopeJoins` and its `later` test;
  - `emitScopeExit`, including `orReturn()` propagation;
  - a panic (§4e says what happens at a panic: follow it);
  - two declarators under **Q12(a): each declarator opens before the next initialiser runs**, so an `orReturn()` in the second initialiser closes the first.
  The close is a fourth kind on `openScope`'s stack (mutex unlock and the existing kinds are the others: read how `using m = mu.lock()` is lowered and follow it exactly).
- The `ffi_handle_file` round trip is the proof. Its sidecar `ffi_handle_file.c` writes the file first and exports an `fclose` wrapper that counts closes. The output must show exactly one close per open on every exit shape §9's H1.2 row lists. Make the count visible in stdout and pinned by the `.out`.
- `ffi_handle_arena` (§5): read §5 on how a handle object's placement interacts with the arena (the object must not be released before its close runs, and the close must not read a released object).
- `caps_ffi_handle` and `reject_ffi_handle_deny`: `--deny ffi` names the `using`, and the capability report offers `ffi` at the `using` (§5). Follow how B1.2 made every buffer call an `ffi` call site.
- wasm32 (CLAUDE.md: "A lowering skipped for wasm32 also covers the freestanding `--profile wasm` route"): the `--target wasm32` IR check and the `--profile wasm` link of `ffi_handle_file` go in the `wasi` section (tests/ffi-handle.js, new, run from tests/run.js like tests/ffi-buffer.js). Read its skip line.
- This is the first stage where a handle value exists at run time, so H1.1's admit side (U1, U2, H2, H3: `f.read()`, `first(f)`, a handle lent to a parameter and lent on) is exercised here. Cover each in `ffi_handle_file` or a sibling positive case, natively.
- `disposeMethod` in src/handles.ts returns the first `[Symbol.dispose]`. H1.1 refuses a second one, a static one and an optional one before this point. Emit the close from that method, and add no new path to it.
- Siblings, as CLAUDE.md requires. A reviewer will probe each one; give each its own case.
  - A `using` in a constructor reached by `new`.
  - Every declarator of a `using`.
  - A `using` inside a loop body (the close runs once per iteration).
  - Nested `using` blocks: the closes run in reverse order of opening.
  - A `using` of a handle next to a `using` of a mutex lock in the same statement and block: the order of release.
  - A `using` in a function that is inlined, specialised or reached through a compile-time function parameter.
  - An early exit from inside a nested block.
- Security: docs/security/runtime.md gets the handle-contract row (§9 says it is H1.2's). Its Tests list names each check by its exact `check(...)` string; grep each one against tests/run.js and tests/ffi-*.js before pushing.
- Docs:
  - docs/LANGUAGE.md: `using` of a handle class now closes at every exit, so drop the "not lowered yet" text.
  - docs/AI.md.
  - The interop guide page, and docs/guide/language/memory.md if it describes `using`.
  - docs/IR_COOKBOOK.md: an entry for the close lowering, plus a docs/cookbook/decl-ffi-handle* program. If its runtime-prelude block moves, run `bash docs/cookbook/regen.sh`.
  - The wp40 status line for H1.2.
- `Measured:`: the cost of the close on a tight `using` loop against the hand-written close, with the noise band (CLAUDE.md). Omit the trailer rather than invent a figure.
- Rolling freeze: src/ must not use the feature. Performance ratchet: no new NL9007 in src/.

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
