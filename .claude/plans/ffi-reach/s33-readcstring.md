You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at f3e8c2eb9347e40f4a1268fa222461c76d14297c (S3.2 merged as #701)
Branch: feature/ffi-reach/s33-readcstring   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #678

## Your stage
feat(interop) — readCString in nish:unsafe and the literal-null CPtr | null parameter (WP27 S3.3)
Goal: readCString(p) copies a C string the program owns into the arena as an unchecked site, and a CPtr | null parameter accepts the literal null while a nullable local must still be narrowed
Owns (do not create or edit files outside these globs): the FFI lane as the plan's 'Shared files and merge order' section defines it, plus tests/cases/reject_unsafe_*: src/** except src/std-modules.ts; runtime/nish.d.ts; runtime/runtime.c, runtime/nish.h, tests/runtime-test.c; tests/cases/ffi_*, tests/cases/panics_ffi_*, tests/cases/reject_ffi_*, tests/cases/reject_unsafe_*, tests/run.js, tests/differential/** (via goldens.js only, plus known-failures.txt), tests/self/goldens/** (via goldens.js only), tests/wordings/**, tests/panics-oracle.js; docs/LANGUAGE.md, docs/AI.md, docs/IR_COOKBOOK.md, docs/cookbook/decl-ffi*, docs/guide/using-nish/interop.md, docs/security/runtime.md, docs/security/README.md, docs/wp27-ffi.md
Verification: npm run check; node tests/run.js ffi; node tests/run.js unsafe; node tests/run.js memory; node tests/run.js wasi; node tests/run.js performance; then an undegraded npm test with the skip count no higher than main's
Targeted tests: node tests/run.js <filter>
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/** (node tests/self/goldens.js --update), tests/differential/goldens/** (node tests/differential/goldens.js --update), tests/cases/*.ll (UPDATE_GOLDENS=1 node tests/run.js <case>), the IR_COOKBOOK runtime-prelude block (bash docs/cookbook/regen.sh), CHANGELOG.md (never touched by a PR)

Todos:
- [s33-readcstring] Add readCString to nish:unsafe (src/nish-modules.ts, src/builtins.ts, runtime/nish.d.ts) lowered to a copy into the arena, recorded by --emit-checked as an allowed unchecked site — see S3.3
- [s33-null-param] Reverse reject_ffi_pointer_nullable_param for the literal null only, with the call-site rule that a CPtr | null variable is narrowed first — see S3.3
- [s33-tests] Add ffi_owned_string (strdup/free and realpath(p, null)/free), reject_ffi_pointer_nullable_variable, extend reject_unsafe_no_import — see S3.3
- [s33-docs] Update LANGUAGE.md Calling C and nish:unsafe, IR_COOKBOOK, the interop guide page, and mark S3 built in docs/wp27-ffi.md — see S3.3
- [s33-goldens] Regenerate tests/self/goldens and the differential goldens and read both diffs — see Verification

Full plan, for context on how your stage fits with the others. Your stage's
detail is in the body sections the todos point to ("— see <Section>"):
  git fetch origin claude/elegant-meitner-wpiki1
  git show origin/claude/elegant-meitner-wpiki1:.claude/plans/ffi-reach.plan.md
Read it. Do not implement anything from another stage — another session owns it
and may be working in parallel right now.

## Stage notes
- This stage builds docs/wp27-ffi.md §8e, §8f and §8g's S3.3 row. Read §8 in full, then read how S3.1 (#695) and S3.2 (#701), both on main, lowered the two string directions. S3.2 copies a returned `const char *` into the caller's arena through an inline IR helper `@nish.ffi.str` (src/emit-strings.ts, `foreignCopy` / `emitForeignStringResult`). Reuse that copy for `readCString` rather than adding a second one, unless you document why not.
- **Lesson from S3.2's review (round 1, a reproduced use-after-free):** a call that newly allocates in the caller's arena must say so in its callee facts. `PassWalk.isOld` (src/escape.ts) and the `using arena()` block rules ask `FunctionFacts.allocates` whether a call's result is fresh. S3.2 fixed it at src/attributes.ts (foreign facts whose return strips to `string` set allocates / allocatesItself / returnsAllocation), and excluded foreign callees in `reclaimsReturnedString`. `readCString` is a builtin, not a foreign callee, so find how builtins that allocate a string (e.g. `substring`, `getenv`) are seen by isOld and by the pass/arena-block rules, and make readCString's result fresh the same way. Pin it with runtime goldens after `churn()`: a `readCString` result returned from inside a `for` loop, assigned to an outer local in `for`/`while`/`do`/`for-of`/nested loops, and kept outside a `using a = arena()` block (that one is a refusal). Model them on tests/cases/ffi_string_loops and reject_ffi_string_arena.
- `readCString(p)` takes a `CPtr` (non-null). Passing a `CPtr | null` is a type error until narrowed. A NULL reaching it at run time is unreachable by the types; say how that is guaranteed. It is an unchecked site: the C string must be NUL-terminated memory the program owns. Record it as an allowed unchecked site in `--emit-checked`, refused without `import ... from "nish:unsafe"` (extend reject_unsafe_no_import), and cover `--deny ffi` / `--deny unsafe` if those capabilities apply.
- The literal-null parameter: `declare function realpath(path: string, resolved: CPtr | null): CPtr | null;` accepts `realpath(p, null)`. A `CPtr | null` variable passed there must be narrowed first. That is reject_ffi_pointer_nullable_variable, with its own NL code and an entry in tests/wordings if the wording is new. Per CLAUDE.md, probe every way in for the narrowing rule: a constructor reached by `new` that makes the call, a method, a function-parameter specialisation, a ternary or `??` argument, and a property read (`this.p`). Each gets a negative case or a check.
- The round trip `ffi_owned_string`: strdup then readCString then free, and realpath(p, null) then readCString then free, with no shim and the expected stdout. `free` is declared `declare function free(p: CPtr): void;`.
- wasm32 and `--profile wasm`: say what readCString lowers to there, or refuse it the way the other FFI paths are refused. CLAUDE.md: "A lowering skipped for wasm32 also covers the freestanding --profile wasm route."
- Retire or reverse reject_ffi_pointer_nullable_param as the plan says. Keep the security record accurate (a new RT row or an extension of RT-14/RT-15, anchored at a commit on your branch and named as such), and keep the docs/security/README.md counts right.
- Rolling freeze: src/ must not use the new feature in its own source.

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
