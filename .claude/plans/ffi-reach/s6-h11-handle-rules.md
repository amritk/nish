You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 5468fd507d95d03f075603d87ccab36f3b4f7c28 (B1.1/B1.2 merged as #709/#738; B1.3 in flight)
Branch: feature/ffi-reach/s6-h11-handle-rules   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #678

## Your stage
feat(checker) — the owned foreign handle: the handle-class shape and the allow-list of where a handle may live (WP40 H1.1)
Goal: A class that owns a CPtr field and closes it in a one-call [Symbol.dispose] is checked against the allow-lists of §4a and §4d, with every shape §6 and §9 name refused by its own case; the emitted close is H1.2 and is not this PR
Owns (do not create or edit files outside these globs): the FFI lane: src/** except src/std-modules.ts; runtime/nish.d.ts; runtime/runtime.c, runtime/nish.h, tests/runtime-test.c; tests/cases/ffi_*, tests/cases/panics_ffi_*, tests/cases/reject_ffi_*, tests/run.js, tests/ffi-buffer.js, tests/ffi-string.js, a new tests/ffi-handle.js, tests/differential/** (via goldens.js, plus known-failures.txt), tests/self/goldens/** (via goldens.js), tests/wordings/**, tests/panics-oracle.js; docs/LANGUAGE.md, docs/AI.md, docs/IR_COOKBOOK.md, docs/cookbook/decl-ffi*, docs/guide/using-nish/interop.md, docs/security/runtime.md, docs/security/README.md, docs/wp27-ffi.md, docs/wp40-ffi-buffers-handles.md, docs/guide/language/memory.md, tests/cases/using_*, tests/cases/reject_using_*, tests/cases/ffi_handle_*, tests/cases/reject_ffi_handle_*
Verification: npm run check; npm run lint; npm run lint:dead; node tests/run.js ffi; node tests/run.js reject_ffi_handle; node tests/run.js using; node tests/run.js codes; node tests/run.js wordings; node tests/run.js self; node tests/run.js selfhost; node tests/run.js differential; WASI_SYSROOT=/usr node tests/run.js wasi (read the skip line); node tests/run.js performance; then an undegraded npm test with the skip count no higher than main's
Targeted tests: node tests/run.js <filter>
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/** (node tests/self/goldens.js --update), tests/differential/goldens/** (node tests/differential/goldens.js --update), tests/cases/*.ll (UPDATE_GOLDENS=1 node tests/run.js <case>), the IR_COOKBOOK runtime-prelude block (bash docs/cookbook/regen.sh), CHANGELOG.md (never touched by a PR)

Todos:
- [h11-shape] The handle class shape of §4a (D1–D5, F, R1, R2, L1, L2) as one positive check with one general refusal (`reject_ffi_handle_field_position` family); the dispose shape (Q5(a)); the class-template check (§6 row 5) — see docs/wp40-ffi-buffers-handles.md §4a, §4b, §6
- [h11-positions] Where an instance may live, §4d (H1–H3, U1, U2, the type rule), as one positive check with general refusals (`reject_ffi_handle_position`, `reject_ffi_handle_type_position`) — see §4d, §6
- [h11-close-call] `reject_ffi_handle_close_call` (Q9 option A) — see §4c, §10
- [h11-sound] Keep main honest until H1.2: refuse the `using`/construction of a handle class with a "not yet lowered" diagnostic, or prove the existing lowering closes on every exit path — see the stage notes
- [h11-tests] Every case §9's H1.1 row names, by exact name, one file per shape with its .err, plus the positive case(s); a checklist of the names in the PR body
- [h11-codes] New NL codes, unreachable.txt, RULE_COUNT
- [h11-docs] LANGUAGE.md, AI.md, the interop guide page (and memory.md if it covers `using`), wp40 status line, security record if applicable
- [h11-goldens] Regenerate tests/self/goldens and the differential goldens with tooling and read both diffs

Full plan, for context on how your stage fits with the others. Your stage's
detail is in the body sections the todos point to ("— see <Section>"):
  git fetch origin claude/elegant-meitner-wpiki1
  git show origin/claude/elegant-meitner-wpiki1:.claude/plans/ffi-reach.plan.md
Read it. Do not implement anything from another stage — another session owns it
and may be working in parallel right now.

## Stage notes
- The design is merged: docs/wp40-ffi-buffers-handles.md on main. Read §1, §4 (all of it: 4a the shape, 4b how the class names its close, 4c use after close, 4d the allow-list of where an instance may live, 4e panics and exit order), §5, §6 (every row), §8, §9's H1.1 row and §10 before writing code. The owner took every recommended answer in §10 (2026-10-19). The ones this stage implements: Q5(a) a one-call `[Symbol.dispose]`, Q6(a), Q7(a) the allow-list, **Q9 option A** (so `reject_ffi_handle_close_call` ships here), Q13(a), Q14(a). Q12 is decided (a), which is H1.2's per-declarator opening, so `reject_ffi_handle_using_exit_in_initialiser` is NOT in this PR.
- The buffer stages B1.1/B1.2 (#709, #738) are merged; B1.3 (`resizesArray = false` for a foreign callee, src/attributes.ts) is in flight on `feature/ffi-reach/s5-b13-no-resize` in another session. Do not touch that fact. If your goldens and B1.3's both move tests/self/goldens/*, whichever lands second merges main and regenerates; never hand-merge.
- **This PR is H1.1 only: the checker rules.** The emitted close (H1.2) and use-after-close (H1.3) are separate PRs by separate sessions after this one merges. Main must stay sound and honest at your head. If H1.1 accepts a handle class and a `using` of it before H1.2 emits the close, a program would compile and silently never close its handle. So either (i) refuse the construction/`using` of a handle class with a clear "not yet lowered" diagnostic that H1.2 removes (as B1.1 did with NL2554), keeping the class declaration and every allow-list check live, or (ii) show that the existing lowering already closes correctly on every exit path §4b lists. Prefer (i); say which you chose and why in the PR body.
- **The rule is an allow-list (§4a, §4d), enforced as one positive check with one general refusal per family** (`reject_ffi_handle_position`, `reject_ffi_handle_type_position`, `reject_ffi_handle_field_position`), not one check per way in. A form neither §6 nor §4d names is refused because it is not on the list. Reviewers will probe with forms the design does not name; the allow-list is what answers them.
- This stage is CLAUDE.md's "A checker rule covers every way in" written large. Every shape there has a named case in §9's H1.1 row: a constructor reached by `new` (row 1, 31), every declarator of a `using` (row 2), `this` out of a constructor (row 3), closures and fields (row 4), type arguments and generics (row 5), and so on. Every case §9's H1.1 row names ships, by its exact name, one file per shape, each with its exact `.err`: the §6 rows, `reject_ffi_handle_field_copy`, `reject_ffi_handle_json`, the five H2 exclusions (`reject_ffi_handle_walk_ctor_param`, `_closure_param`, `_nested_param`, `_rest_param`, `_optional_param`), and one `reject_ffi_handle_walk_*` per form of §4d's walk that no §6 row covers. Make a checklist of the row's names in the PR body and tick each one.
- Positive cases: at least one `ffi_handle_*` case that declares a well-formed handle class (D1–D5, F, R1, R2, L1, L2) and passes it through each allowed position (H1–H3, U1, U2) to the extent the checker can show it without lowering: an `--emit-checked` golden or a `.ll` with no handle use. Plus the class-template check (§6 row 5).
- New NL codes for new wordings, retired ones in tests/wordings/unreachable.txt, RULE_COUNT kept right; `node tests/run.js codes` and `wordings` pass; `diagnostic-coverage --require-coverage --strict-refusals` exit 0.
- Docs: docs/LANGUAGE.md (the handle class rule: what is accepted now, and that a `using` of one is refused until the close is emitted, if you take (i)); docs/AI.md; docs/guide/using-nish/interop.md (and docs/guide/language/memory.md if it describes `using`); the wp40 status line for H1.1; docs/security/runtime.md if the rule has a security row (Tests list names each check by its exact `check(...)` string).
- Rolling freeze: src/ must not use the feature in its own source. Performance ratchet: no new NL9007 in src/.

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
