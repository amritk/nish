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
- [`.claude/selfhost.md`](./.claude/selfhost.md) — working in `self/`: Nish-0, the seed, the module map, how it is tested
- [`.claude/architecture.md`](./.claude/architecture.md) — the pipeline, the rules that shape every change, where to read next
- [`.claude/typescript.md`](./.claude/typescript.md) — TypeScript style: the Nish rules for every program in the repo, the compiler included, and the static-friendly rules for the JavaScript tooling
- [`.claude/node.md`](./.claude/node.md) — Node runtime, npm scripts, the LLVM toolchain, Biome
- [`.claude/testing.md`](./.claude/testing.md) — the golden-test harness, what every construct ships with
- [`.claude/comments.md`](./.claude/comments.md) — comment and JSDoc guidelines

## What this is

`nish` (**Nish**) is an ahead-of-time compiler from a strictly static
subset of TypeScript to LLVM IR. The compiler is written in Nish itself, in
`self/`, and built by the previous released `nish` — the seed — the way rustc
and Go build themselves; the TypeScript implementation that used to seed it
(`src/`, "stage0") was deleted in WP19 R6. The repository is a **Node.js + npm**
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
npm run build               # self/, built by the seed, into build/nish
npm run check               # ambient tsc --noEmit over self/, std/, tests/nish
npm test                    # the full suite (goldens, llvm-as, native, runtime, differential)
node tests/run.js <sub>     # only cases whose name contains <sub>
npm run test:update         # write missing .ll goldens for new cases
npm run lint                # biome, advisory
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
| the version | `nish --version` | `nish <semver>` on stdout, exit 0 |
| what the compiler parsed | `nish --emit-ast <file>` | the syntax tree, one node per line |
| what the checker recorded | `nish --emit-checked <file>` | the side tables the emitter reads |

Every `--json` object is flat:
`{"file","line","column","endLine","endColumn","severity","code","message"}`,
1-based, `endLine`/`endColumn` exclusive.

- **`severity`** is `"error"` or `"performance"`. A performance warning never
  changes the exit code.
- **`code`** is the stable rule identifier — `NL1013`, `NL2231` — and is the
  field to key on. The prose in `message` may improve between releases; the
  code may not. `NL0000` means the message has no rule yet. The bands
  (`NL1xxx` Phase 0, `NL2xxx` checker, `NL3xxx` driver, `NL4xxx` interop,
  `NL9xxx` performance, `NL0001`–`NL0003` syntax / toolchain / internal) and
  the registry are documented in
  [`docs/wp10-ci.md`](./docs/wp10-ci.md#code). The registry is
  `self/codes.ts`, and it is **kept by hand**: a new diagnostic gets the next
  free number in its band, and a number is never moved or handed out twice.
  `node scripts/gen-diagnostic-codes.mjs --check` validates its format and that
  every code is unique, and `npm test` runs it.
- A failure with no source position — an unusable C toolchain, an internal
  compiler error, a bad `-o` layout — is still one JSON line,
  `{"severity","code","message"}`. Under `--json` you never have to read stderr
  to find out why a run failed.

Exit codes (`docs/wp12-release.md`): **0** ok, **1** the program was rejected,
**2** usage, **3** toolchain (clang, `scripts/build.sh`, or the prebuilt
compiler the `nish` command hands over to), **70** internal compiler error — a
bug in `nish`, not in the input. All three of 3's causes are one `NL0002`
object under `--json`; the `message` is what tells them apart.

## Trusting a test run

`npm test` ends with `N passed, M failed, K skipped`. **The skip count is the
number that decides what a green run is worth**: without LLVM 18 the
toolchain-dependent checks — assembly, native round trips, linking, the interop
addons, building the compiler at all, the differential suite — skip rather than
fail, and the run prints a `DEGRADED:` banner naming the tools it could not
find. A run that skipped anything has not proved what it looks like it proved.
`.claude/hooks/session-start.sh` installs the toolchain in a fresh container so
this does not happen silently.

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
  environmental ones (no WASI sysroot, `NISH_BOOTSTRAP` unset, no `jq` for the
  WP19 seed-matrix states), means the run did not prove what a green summary
  looks like it proved, and the change is therefore untested whatever the exit
  code said.
- `npm run lint` no worse than `main` — the warning count is a backlog, so it
  may not grow.
- `node docs/check-links.mjs` when the change touches Markdown.
- The title is a conventional commit subject, because a squash merge lands it
  as the release-note heading. `node scripts/changelog-gen.mjs --check-subject`
  is the same rule `pr-title.yml` enforces.

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
  generated files with the repo's own tooling rather than by hand.
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

## House rules

- **`npm test` must be green**, and every new construct ships with a golden
  `.ll`, an `llvm-as` pass, a native round trip with expected stdout, at least
  one negative test, its `docs/LANGUAGE.md` rule and cookbook entry, and a
  `CHANGELOG.md` line. There is no changesets flow here; the changelog is the
  record.
- **A construct is implemented once, in `self/`.** There is no second
  implementation to compare it with since WP19 R6
  ([wp19](./docs/wp19-stage0-retirement.md)), so its golden `.ll`, its native
  round trip and `tests/nish-cmp.js` — the last release against this tree —
  are what prove the lowering. **The rolling freeze** still holds: `self/` may
  not use the construct in its own source until the seed compiles it, which is
  the next release, and CI's `bootstrap` job fails the pull request that
  tries.
- **Never emit an LLVM attribute you cannot cite a checker proof for.** Write
  the reason in `self/attributes.ts` beside the code.
- **A struct layout change touches `self/runtime.ts` and `runtime.c` in the same
  commit** and extends a layout test. The C runtime is two translation units
  with a budget each — `runtime.c` for the core and `runtime_os.c` for whatever
  wraps a system call — so keep both inside theirs (`node tests/run.js budget`)
  and report the size of whichever you changed in the PR.
- **Do not widen scope into another work package's files**; leave a
  `TODO(WP<n>)` instead.
- **Never** put Claude/session links, tracking IDs, model names or platform
  attributions in commits, code, or PR text. Commit messages: imperative
  subject, body explaining the lowering.
- **Declare a function as an arrow bound to a `const`**, in the compiler
  (`self/`, an Nish program) and in the JavaScript tooling alike: the language
  has arrow functions ([wp22](./docs/wp22-arrow-functions.md)), so a function
  is `const f = (a: i32): i32 => ...` and the `function` keyword is the legacy
  spelling. The rule is linted at `warn` while the tooling is migrated, so the
  warning count is the backlog rather than a failure. Class methods stay
  methods. A struct is a `class` or an `interface`: a `type` alias only renames
  a type that already exists.
- Match the surrounding code's style, comment density, and naming. Biome
  (`biome.json`) is the formatter and linter, run with the formatter disabled
  in `npm run lint`; keep new files formatted and do not reformat files you did
  not otherwise change.
- Show the exact LLVM IR for every TypeScript snippet a PR adds to the tests.
