# AGENTS.md

Guidance for AI coding agents (Cursor, Copilot, Claude Code, …) working **on
this compiler**. If you are instead **writing a program in the language**, this
is the wrong file: read [`docs/AI.md`](./docs/AI.md), which is the whole
language stated as rules in one pass, with the TypeScript reflexes Nish rejects
listed first. [`llms.txt`](./llms.txt) indexes both.

For Claude Code the same rules live in
[`CLAUDE.md`](./CLAUDE.md); the detailed developer guidelines are in
[`.claude/`](./.claude/) — read the one that matches your task:

- [`.claude/orientation.md`](./.claude/orientation.md) — **start here**: the compiler and its seed, the code map, the commands, what is always true
- [`.claude/selfhost.md`](./.claude/selfhost.md) — working in `src/`: Nish-0, the seed, the module map, how it is tested
- [`.claude/architecture.md`](./.claude/architecture.md) — the pipeline, the rules that shape every change, where to read next
- [`.claude/typescript.md`](./.claude/typescript.md) — TypeScript style: the Nish rules for every program in the repo, the compiler included, and the static-friendly rules for the JavaScript tooling
- [`.claude/node.md`](./.claude/node.md) — Node runtime, npm scripts, the LLVM toolchain, Biome
- [`.claude/linting.md`](./.claude/linting.md) — what the linters enforce and why: kebab-case files, camelCase names, the Biome rule set, knip and the format hook
- [`.claude/testing.md`](./.claude/testing.md) — the golden-test harness, what every construct ships with
- [`.claude/comments.md`](./.claude/comments.md) — comment and JSDoc guidelines
- [`.claude/licensing.md`](./.claude/licensing.md) — third-party code: what counts as a copy, the notice it keeps, the licences allowed

## What this is

`nish` (**Nish**) is an ahead-of-time compiler from a strictly static
subset of TypeScript to LLVM IR. The compiler is written in Nish itself, in
`src/`, and built by the previous released `nish` — the seed — the way rustc
and Go build themselves; the TypeScript implementation that used to seed it
("stage0", which lived in its own `src/` while this compiler was in `self/`)
was deleted in WP19 R6. The repository is a **Node.js + npm**
project for its tooling: the test harness, the scripts and the installer are
JavaScript, `typescript` is a development dependency for `npm run check`, and
the published package has no runtime dependency at all — it hands over to a
prebuilt native compiler. The sibling repos' Bun rules do not apply here. The
reference documents are [`docs/LANGUAGE.md`](./docs/LANGUAGE.md) (what the language is) and
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (how the compiler is put
together); [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md) is the work-package
plan, with the conventions every agent follows in §7 and a brief template in §8.

## Workflow

```bash
npm install                 # install (npm ci in CI)
bash scripts/fetch-seed.sh  # the last release into build/seed/, once (or set NISH_BOOTSTRAP)
npm run build               # build/nish to keep; npm test builds its own
npm run check               # ambient tsc --noEmit over src/, std/, tests/nish
npm test                    # the full suite (goldens, llvm-as, native, runtime, differential)
node tests/run.js <sub>     # only cases whose name contains <sub>
npm run test:update         # write missing .ll goldens for new cases
npm run lint                # file names + biome, formatting included; any finding fails CI
npm run lint:dead           # knip: unused files, exports and dependencies
npm run smoke               # build and run every example with a main
```

Most of `npm test` needs LLVM 18 on `PATH` (`clang`, `llc`, `llvm-as`, `opt`,
`ld.lld`, `wasm-ld`); without it the toolchain-dependent checks are skipped,
not failed, so a green run without LLVM proves less than it looks. Install
steps per OS are in [`docs/INSTALL.md`](./docs/INSTALL.md).

## Machine-readable surfaces

Read these rather than scraping prose; they are contracts with tests behind
them — the WP12 block of `tests/run.js`, and
[`tests/nish/cli.ts`](./tests/nish/cli.ts), which asks the same questions from a
program written in Nish that reads the answers the way a wrapper does
(`npm run test:cli`, or `build/nish-cli <compiler>` against any other build).
[`docs/AI.md`](./docs/AI.md) documents the same surfaces for an agent *using*
the compiler, and ships in the npm tarball so an install describes
itself.

| Ask | Command | Answer |
| --- | --- | --- |
| what the CLI accepts | `nish --help` | usage text on **stdout**, exit **0**. A usage *error* prints the same text on stderr with exit 2, so the stream and the code tell a request apart from a refusal |
| what is wrong with a program | `nish --json <files>` | one JSON object per line on **stdout**, which carries nothing else — the `wrote <file>` progress line and the human report are on stderr — exit unchanged |
| fix what can be fixed mechanically | `nish --fix <files>` | the named files rewritten in place, then the remaining diagnostics as a plain run reports them, and its exit code |
| the version | `nish --version` | `nish <semver>` on stdout, exit 0 |
| what the compiler parsed | `nish --emit-ast <file>` | the syntax tree, one node per line |
| what the checker recorded | `nish --emit-checked <file>` | the side tables the emitter reads |
| where the program can panic | `nish --emit-panics <file.json> <files>` | one JSON object in the file, every function with its panic sites, each with its kind and whether the checker proved it away ([LANGUAGE.md](./docs/LANGUAGE.md#panic-sites)); the IR is unchanged |
| that a module cannot panic | `nish --deny-panics <files>`, or `"nish": { "noPanic": [...] }` in the root `package.json` | every unproven panic site in scope is an error (NL2457, or NL2458 at a call out of the scope) naming its kind and the guard that proves it; out of memory is allowed; the IR is unchanged ([LANGUAGE.md](./docs/LANGUAGE.md#the-no-panic-scope)) |
| what the program can reach | `nish <files> --emit-capabilities <file.json>` | the capabilities every function, module and package can reach (files, processes, the network, the environment, the clock, entropy, signals, `exit`, C calls), each with a witness call chain, and each function's panic sites, as byte-stable JSON; `nish run --capabilities` prints the one-line summary on stderr before the program runs ([LANGUAGE.md](./docs/LANGUAGE.md#capabilities)) |
| that the program reaches only what it may | `nish <files> --allow <cap>[,<cap>...]` and `--deny <cap>[,<cap>...]`, or `"nish": { "capabilities": { "allow": [...], "deny": [...] } }` in the root `package.json` | a program is refused (NL2459) when a function outside code can call — `main` in a closed `--link` build, every host-visible function in an open one — reaches a capability the policy does not grant: one error per capability, spanned at the first call of the witness chain and naming every hop; an unknown name, `--allow unsafe`, a capability both allowed and denied or a `=<dir>` scope is a usage error (exit 2), and a malformed manifest policy is NL3032–NL3035, and a `"nish"` field that is not one object of `noPanic` and `capabilities`, each written once, is NL3036; the IR is unchanged ([LANGUAGE.md](./docs/LANGUAGE.md#the-capability-policy)) |

Every `--json` object is flat:
`{"file","line","column","endLine","endColumn","severity","code","message"}`,
1-based, `endLine`/`endColumn` exclusive, and a trailing `"fix"` when there is one.

- **`severity`** is `"error"`, `"performance"`, `"portability"` or
  `"deprecation"`. A warning never changes the exit code, a portability warning
  prints only under `--warn-portability`, and a deprecation warning always
  prints.
- **`code`** is the stable rule identifier — `NL1013`, `NL2231` — and is the
  field to key on. The prose in `message` may improve between releases; the
  code may not. `NL0000` means the message has no rule yet. The bands
  (`NL1xxx` Phase 0, `NL2xxx` checker, `NL3xxx` driver, `NL4xxx` interop,
  `NL7xxx` deprecation, `NL8xxx` portability, `NL9xxx` performance, `NL0001`–`NL0003` syntax / toolchain / internal) and
  the registry are documented in
  [`docs/wp10-ci.md`](./docs/wp10-ci.md#code). The registry is
  `src/codes.ts`, and it is **kept by hand**: a new diagnostic gets the next
  free number in its band, and a number is never moved or handed out twice.
  `node scripts/gen-diagnostic-codes.mjs --check` validates its format and that
  every code is unique, and `npm test` runs it. The driver's whole-program
  refusals carry codes like any other: a function two modules both define is
  NL3024–NL3027 (exported or private; each across the program or within one
  package), a class or interface name two modules of one package both declare
  is NL3028 (#193; it and NL3013, its generic spelling, preempt NL3022–NL3023,
  the shared constructor or method such classes used to be refused for), and `tests/nish/cli.ts` checks them
  from the `tests/link/` programs that provoke them.
- **`fix`** is the one optional key, and it comes last, after `message`: a
  list of edits that make the diagnostic go away,
  `[{"line","column","endLine","endColumn","text"}]`. Each edit is placed as
  the diagnostic is — 1-based, columns in UTF-16 code units, the end
  exclusive — and replaces that span of the diagnostic's own file with `text`;
  a span whose start equals its end is an insertion. The key is **absent**,
  never an empty list, when the compiler knows no safe rewrite, so every line
  without one is byte-identical to what it was before the key existed. A fix
  is **behaviour-preserving**: it is attached only when the rewrite means what
  the author plainly meant and the TypeScript reading is unchanged, and in
  doubt there is none. A site reports one through `DiagnosticSink.reportFix`
  (or `reportPerformanceFix`, `reportPortabilityFix`) and, in the checker,
  `ctx.errorFix` / `ctx.performanceFix` with edits built by `ctx.edit`, and
  every fix and every shape refused one has a case in
  [`tests/fix/`](./tests/fix/README.md). A warning can carry one too. NL9007,
  an index not proven in range inside a loop, inserts
  `if (!(i >= 0 && i < toI32(xs.length))) { panic("index out of range") }`
  before the statement, which the bounds analysis credits, and only where the
  index is an `i32`, the access is not behind a branch or in a loop's
  header, nothing else the statement runs before its branches calls,
  allocates or assigns, and `panic` and `toI32` are the builtins.
- **`nish --fix <files> [flags]`** applies them (`src/fix.ts`): it compiles,
  takes every fix in a file named on the command line (never one under
  `node_modules`, the standard library or a `nish:` module), drops a fix that
  overlaps one earlier in report order — the next round reports it again —
  rewrites only a file that has an edit, and recompiles, until a round applies
  nothing or five have. Then it reports the last compile exactly as a run
  without `--fix` would, human or `--json`, and exits with its code; it writes
  no IR, so `-o`, `--link` and the other product flags are a usage error
  (exit 2). Each rewrite prints `fixed <file> (N edits)` on stderr. It
  rewrites files **in place**, with no backup and no atomic swap, so run it on
  a committed or backed-up tree.
- A failure with no source position — an unusable C toolchain, an internal
  compiler error, a bad `-o` layout — is still one JSON line,
  `{"severity","code","message"}`. Under `--json` you never have to read stderr
  to find out why a run failed.

Exit codes (`docs/wp12-release.md`): **0** ok, **1** the program was rejected,
**2** usage, **3** toolchain (clang, `scripts/build.sh`, or the prebuilt
compiler the `nish` command hands over to), **70** internal compiler error — a
bug in `nish`, not in the input. All three of 3's causes are one `NL0002`
object under `--json`; the `message` is what tells them apart. `nish run
<file.ts> [args ...]` uses the same bands up to the moment the program starts,
and answers the program's own exit status after that.

## Trusting a test run

`npm test` ends with `N passed, M failed, K skipped`. **The skip count is the
number that decides what a green run is worth**: without LLVM 18 the
toolchain-dependent checks — assembly, native round trips, linking, the interop
addons, building the compiler at all, the differential suite — skip rather than
fail, and the run prints a `DEGRADED:` banner naming the tools it could not
find. A run that skipped anything has not proved what it looks like it proved.
`.claude/hooks/session-start.sh` installs the toolchain in a fresh container so
this does not happen silently.

In CI the `test` job's summary also ends `…, 1 delegated.` That is the
bootstrap's fixed point, which the job hands to the `bootstrap (x86_64-linux)`
row of the same run rather than proving it twice; it is not a skip, and it is
named with the job that proves it. A local `npm test` delegates nothing
(`.claude/testing.md`).

## Shipping a change: what a pull request must be, and who merges it

**A pull request that goes up is finished work: fully tested, and clear of
conflicts.** Opening one before that is not "early feedback" here, because
nobody is waiting to give it — it is a red pull request somebody else has to
read.

*Fully tested* means the [definition of done](#house-rules) was **run**, not
assumed:

- `npm run check` green.
- `npm test` green **and not degraded**. Read the skip count, per *Trusting a
  test run* above: a `DEGRADED:` banner, or a skip that is not one of the three
  environmental ones (no WASI sysroot on a local machine, though never in CI,
  whose `test` job installs one; `NISH_BOOTSTRAP` unset; no `jq` for the WP19
  seed-matrix states), means the run did not prove what a green summary
  looks like it proved, and the change is therefore untested whatever the exit
  code said.
- `npm run lint` and `npm run lint:dead` clean: every rule is an error.
- `node docs/check-links.mjs` when the change touches Markdown.
- The title is a conventional commit subject, because a squash merge lands it
  as the release-note heading. `node scripts/changelog-gen.mjs --check-subject`
  is the same rule `pr-title.yml` enforces. A break (`type!` or a
  `BREAKING CHANGE:` trailer) moves the minor, because the project stays on
  0.x until its owner says otherwise: do not propose or cut 1.0.0, and do not
  add a `Release-As:` trailer. The stability rule at the head of
  [LANGUAGE.md](./docs/LANGUAGE.md) says what counts as a break in the
  language.

*Clear of conflicts* means the branch merges into `main` as it stands. Merge
`main` in and resolve **before** pushing, rather than leaving the conflict for
a reviewer to discover.

### Merging it yourself

**When those things are true and CI is green, an agent merges its own pull
request — with squash — rather than waiting to be told to.** Waiting is not
caution when nobody is coming; it is just a finished change sitting unmerged.
All five conditions, every one of them checked against the pull request as it
is now:

1. **Every required check is green on the *current head*.** A run from three
   pushes ago proves nothing about this commit.
2. **No conflict with `main`** (`mergeable_state` is clean).
3. **The suite was actually run** on this change, undegraded, per above.
4. **No human is objecting**: no changes-requested review, no unresolved review
   thread. Answer or implement first, then merge.
5. **It is not the Release PR.** `chore(release): <version>` on `release/next`
   is opened by `release-pr.yml`, and merging it *is* the act of releasing — it
   tags, which dispatches `release.yml`, which publishes to npm. It is the
   review step for the release notes before anyone can read them
   ([wp12-release.md](./docs/wp12-release.md)), so it stays a human's decision
   no matter how green it is. An agent never merges it.

Squash, always: GitHub uses the pull request title as the subject of the single
commit that lands, and that subject is what the changelog generator reads.

> **The Release PR is never an agent's to merge on its own initiative.** Not
> because CI is green, not because it is the only thing left open, not because a
> release looks due. Merging it *publishes* — the tag it creates dispatches
> `release.yml`, which builds the artifacts and pushes the tarball to npm, and
> nothing downstream of that is undoable. An agent may prepare it, check it and
> say it is ready; a human clicks merge. `release-pr.yml` writes the same
> warning into the pull request body it generates, so the rule is on the pull
> request itself and not only in this file.

### When it is not ready

**Do not stop, and do not ask — watch and work.** Subscribe to the pull request
and, on every event, drive it toward the state above rather than reporting that
it is not there yet:

- **Red CI** → root-cause it and push the fix. "Flake" is not a root cause; a
  failing test is a failing test. Never skip, disable or quarantine one to get
  green, and never push an empty commit to kick CI.
- **A conflict** → merge `main` in and resolve it, regenerating lockfiles and
  generated files with the repo's own tooling rather than by hand. **Expect it
  on the self-goldens:** `tests/self/goldens/checked-self.txt` (and often
  `checked.txt`) is a dump of `src/`, so every `src/` commit on `main`
  conflicts with every open pull request that touches `src/`, and `main` can
  move faster than one CI run. Merge `main` in (never rebase), regenerate with
  `node tests/self/goldens.js --update` after `npm run build`, re-check that a
  new diagnostic still has the next free code in `src/codes.ts`, run
  `npm run check` and `node tests/run.js self` plus your change's own prefix,
  and push; CI is the full gate. A pure merge of `main` carries nothing else.
- **A review** → implement the small, local asks and push; reply with a proposal
  for the large ones. Resolve the threads you addressed.

Then merge, the moment all five conditions hold. Webhooks do not cover
everything — CI success and merge-state transitions arrive late or not at all —
so re-check on a schedule rather than trusting events alone, and keep going
until the pull request is merged or closed.

The one thing that ends this without a merge is a blocker you cannot clear
alone: a failure that is not this change's and has no fix to port, or a design
question only the author can settle. Say so once, on the pull request, naming
what is blocking and what you need — and keep watching.

### Reviewing a pull request

- **Read the diff from a checkout, not the API.** The GitHub API truncates the
  diff and the file list of a large pull request; one review here saw 33 of
  126 files and reported tests "missing" that were in the PR (#295). Review
  `git diff origin/main...<head>` in a local checkout, and confirm any "file X
  is missing" claim with `git ls-tree <head>` before raising it.
- **A runtime race or leak needs a reproduction in Nish.** A defect shown only
  by a C harness calling the runtime directly is not confirmed until a program
  the checker accepts reaches it. The checker already refuses every runtime
  call that writes shared state inside a `scope()` task or a parallel region,
  so a thread-interleaving scenario is often unreachable from the language
  (#312 had two such findings, which were fixed and later found unreachable).
  Compile the program and show it failing before calling the finding
  confirmed.

## House rules

- **`npm test` must be green**, and every new construct ships with a golden
  `.ll`, an `llvm-as` pass, a native round trip with expected stdout, at least
  one negative test, its `docs/LANGUAGE.md` rule and cookbook entry, and a
  `CHANGELOG.md` line. There is no changesets flow here; the changelog is the
  record.
- **A construct is implemented once, in `src/`.** There is no second
  implementation to compare it with since WP19 R6
  ([wp19](./docs/wp19-stage0-retirement.md)), so its golden `.ll`, its native
  round trip and `tests/nish-cmp.js` — the last release against this tree —
  are what prove the lowering. **The rolling freeze** still holds: `src/` may
  not use the construct in its own source until the seed compiles it, which is
  the next release, and CI's `bootstrap` job fails the pull request that
  tries.
- **Never emit an LLVM attribute you cannot cite a checker proof for.** Write
  the reason in `src/attributes.ts` beside the code.
- **A struct layout change touches `src/runtime.ts` and `runtime.c` in the same
  commit** and extends a layout test. The C runtime is five translation units
  with a budget each — `runtime.c` for the core, `runtime-os.c` for the
  syscall wrappers, `runtime-parallel.c` for threads, `runtime-host.c` for
  the clock, entropy, file times and signals and `runtime-net.c` for the
  sockets of `nish:net` — so keep each inside its own
  (`node tests/run.js budget`) and report the size of whichever you changed in
  the PR. An addition that does not fit goes in a new unit with its own
  ceiling rather than a raised one, and a new unit is named in the five places
  `.claude/architecture.md` lists, `scripts/build.sh` first.
- **Third-party code keeps its licence.** A file ported, translated or
  adapted from elsewhere carries the upstream copyright and licence notice, its
  licence text is in the repository (and in the package if the file ships), it
  is listed in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md), and the PR
  body names its origin. Only MIT-compatible licences; never GPL-family,
  Rosetta Code, Stack Overflow, Project Euler or unlicensed code.
  [`.claude/licensing.md`](./.claude/licensing.md) has the rule and
  `node tests/run.js third-party-licence` checks it.
- **Do not widen scope into another work package's files**; leave a
  `TODO(WP<n>)` instead.
- **Never** put Claude/session links, tracking IDs, model names or platform
  attributions in commits, code, or PR text. Commit messages: imperative
  subject, body explaining the lowering.
- **Declare a function as an arrow bound to a `const`**, in the compiler
  (`src/`, an Nish program) and in the JavaScript tooling alike: the language
  has arrow functions ([wp22](./docs/wp22-arrow-functions.md)), so a function
  is `const f = (a: i32): i32 => ...` and the `function` keyword is the legacy
  spelling, and the lint rule is an error. Class methods stay methods. A struct is a `class` or an `interface`: a `type` alias only renames
  a type that already exists.
- Match the surrounding code's style, comment density, and naming. Biome
  (`biome.json`) is the formatter and linter, and `npm run lint` checks both,
  so run `npm run format` before committing (an agent's edits are formatted by
  the `PostToolUse` hook). File and directory names are kebab-case, values
  camelCase, types PascalCase, and the code has no semicolons except where
  JavaScript's insertion rule needs one;
  [`.claude/linting.md`](./.claude/linting.md) has the rule set.
- Show the exact LLVM IR for every TypeScript snippet a PR adds to the tests.
