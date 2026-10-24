You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 081d61e5d85edf88edeaacef95c70893f15f48ea (H1.2 merged as #861)
Branch: feature/ffi-reach/s6-h13-use-after-close   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #678

## Your stage
test(checker) — the owned foreign handle: use after close is refused (WP40 H1.3)
Goal: every way a program could name a handle object after its `using` block has closed it is refused at compile time, each shape pinned by its own `.err` golden that is shown to reach the rule that refuses it; WP40's H1 bar is met and its status says so
Owns (do not create or edit files outside these globs): the FFI lane: src/** except src/std-modules.ts; runtime/nish.d.ts; tests/cases/ffi_*, tests/cases/reject_ffi_*, tests/cases/ffi_handle_*, tests/cases/reject_ffi_handle_*, tests/cases/reject_using_*, tests/run.js, tests/ffi-handle.js, tests/self/parser-refusals.txt, tests/differential/** (via goldens.js, plus known-failures.txt), tests/self/goldens/** (via goldens.js), tests/wordings/**; docs/LANGUAGE.md, docs/AI.md, docs/IR_COOKBOOK.md, docs/guide/using-nish/interop.md, docs/guide/language/memory.md, docs/security/runtime.md, docs/security/README.md, docs/wp40-ffi-buffers-handles.md
Verification: npm run check; npm run lint; npm run lint:dead; node tests/run.js ffi_handle; node tests/run.js reject_ffi_handle; node tests/run.js using; node tests/run.js codes; node tests/run.js wordings; node tests/run.js self; node tests/run.js selfhost; node tests/run.js differential; WASI_SYSROOT=/usr node tests/run.js wasi (read the skip line); node tests/run.js performance; diagnostic-coverage --require-coverage --strict-refusals; then an undegraded npm test with the skip count no higher than main's
Targeted tests: node tests/run.js <filter>
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/** (node tests/self/goldens.js --update), tests/differential/goldens/** (node tests/differential/goldens.js --update), tests/cases/*.ll and *.err (UPDATE_GOLDENS=1 node tests/run.js <case>), the IR_COOKBOOK runtime-prelude block (bash docs/cookbook/regen.sh), CHANGELOG.md (never touched by a PR)

Todos:
- [h13-after] `reject_ffi_handle_use_after_close`: the binding named after its block (`let x = 0; { using f = new File(p) } f.read()`); pin its message — see docs/wp40-ffi-buffers-handles.md §9 (H1.3 row), §4c "What placement proves"
- [h13-keep] `reject_ffi_handle_use_after_close_keep`: a callee that tries to keep the object it was lent (`let saved` assigned from an H2 parameter), refused by §6 row 15 — see §6, §4d
- [h13-siblings] One case file per further shape (§6 "One case file per shape"), listed in the stage notes; cite the existing case where one already pins a shape instead of duplicating it
- [h13-sweep] A mutation-sweep table in the PR body: for each new case, the rule disabled and the `.err` that moved, so every case is shown to reach its rule
- [h13-docs] docs/LANGUAGE.md (the handle rule says use after close is refused statically, and how), docs/AI.md if its handle line needs it, the interop guide if it shows the diagnostic, docs/security/runtime.md RT-20's Tests list with exact check strings, and the wp40 status line (H1.3 built, H1's bar met)
- [h13-goldens] Regenerate every generated file the change moves, with tooling, and read the diffs

Full plan, for context on how your stage fits with the others. Your stage's
detail is in the body sections the todos point to ("— see <Section>"):
  git fetch origin claude/elegant-meitner-wpiki1
  git show origin/claude/elegant-meitner-wpiki1:.claude/plans/ffi-reach.plan.md
Read it. Do not implement anything from another stage — another session owns it
and may be working in parallel right now.

## Stage notes
- H1.1 (#850, `9260a2c`) built the handle-class rules and the positions a handle may live in (§4a, §4d). H1.2 (#861, `081d61e`) made `using` of a handle class close it at every exit. Read both squash messages (`git log -1 9260a2c`, `git log -1 081d61e`) and `src/handles.ts`. There are already some 90 `reject_ffi_handle_*` cases; `git ls-tree --name-only origin/main tests/cases/ | grep ffi_handle` lists them.
- **This stage is expected to be tests and docs only.** WP40 §4c argues that placement already makes use after close unreachable: outside its own methods an object is named only by its `using` binding and by the H2 parameters it is lent to, the parameter's name ends inside the block, and the binding goes out of scope where the close is emitted. H1.3 proves that argument with cases. **If any shape below compiles today, that is a soundness hole**: fix it in `src/handles.ts` (or wherever the rule lives, inside the lane), give it its case, name it under "Flags for review" in the PR body, and retitle the PR `fix(checker): …`. Do not open a separate PR for it.
- **Every case must reach the rule it is named for.** H1.1's first review round found cases that a different, earlier error refused, so they pinned nothing. For each case, disable the rule you claim refuses it (locally, not committed), rerun the case, and record in the PR body's sweep table that its `.err` moved. When the refusal is a generic scope error (`Cannot find name 'f'` or the seed's wording), say so: the case pins the message the design names, and the sweep row reads "scope rule (not a handle rule)".
- Use after close by the binding (todo h13-after), plus these siblings, one file each unless an existing case already pins it:
  - read after a nested block inside a loop body, in the next iteration (the binding was opened in an earlier one);
  - read in a later `case` of a `switch` whose earlier case opened it;
  - read in the `else` of an `if` whose `then` opened it;
  - a `using` in a constructor reached by `new` (a constructor is a call, CLAUDE.md), with the instance named after the constructor's block.
- Keeping a lent object (todo h13-keep). Row 15's `let saved` from an H2 parameter is the named case. Then probe each other way a callee or a constructor could keep it past the call, and either cite the existing case or add one:
  - a module-level `let` assigned from the parameter, both as a statement and as an expression (`g(saved = f)`);
  - a local `let` that outlives nothing but is an alias (row 15, `reject_ffi_handle_alias`?);
  - a field of another class (`this.keep = f` in a method, and in a constructor: `new Keeper(f)`, where the constructor parameter is the way in);
  - `h.l = this` inside the handle class's own constructor or method (CLAUDE.md: follow `this` out of its constructor; `reject_ffi_handle_this_escapes`?);
  - pushing into an array, a `Map`, a closure that captures it, returning it, a `scope()` task, a `Channel` (rows 10, 12, 28, 29: cite the existing cases);
  - a keep through a compile-time function parameter or a generic function, if the language admits one.
  CLAUDE.md: "A checker rule covers every way in, not only the one its tests write." Probe every sibling in the same round, not only after review finds one.
- CI-only checks a local filter can miss (both turned H1.1 red): a new `reject_*` case refused before the checker is listed in `tests/self/parser-refusals.txt`, and a new or reordered code in `src/codes.ts` keeps the file's order. `node tests/run.js codes` and the `self` section catch both; run them.
- Negative cases are not registered in the differential goldens; if the `--emit-ts` differential lists them anyway, add them the way `tests/differential/emit-ts-known.txt` already lists the other `reject_ffi_handle_*` cases. Never hand-edit a line that another case owns (H1.2's main merge dropped `str_surrogate_pair` from that file and turned CI red).
- Security: RT-20 in docs/security/runtime.md is the handle-contract row. Add each new check to its Tests list by its exact `check(...)` string and grep each one against tests/run.js and tests/ffi-*.js before pushing. Do not move its anchors silently: a rewritten row names the commit its anchors are at (CLAUDE.md, "Security").
- Docs: WP40 §9 says "H1's bar is a class that owns an `fopen` handle and is closed by `using`, with use after close refused and one negative case per sibling". Update the status paragraph at the top of the doc (line ~23, "H1.3 is unbuilt") to say H1.3 is built and that this bar is met. In LANGUAGE.md, state the rule a user sees: a handle cannot be named after its block, and a lent handle cannot be kept. The guide changes only if it shows one of these diagnostics.
- No `Measured:` trailer: a stage of refusals has no run-time cost to measure.
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
