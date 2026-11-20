# Project rules

**New session? Read [`.claude/orientation.md`](.claude/orientation.md) first**
— the map of the repository, the compiler, the seed and the commands. Then read
only the guide your task touches; the rules there are authoritative:

| Before you… | Read |
| --- | --- |
| touch `src/` (the compiler) | [`.claude/selfhost.md`](.claude/selfhost.md) |
| write TypeScript anywhere | [`.claude/typescript.md`](.claude/typescript.md), [`.claude/comments.md`](.claude/comments.md) |
| add or change a test | [`.claude/testing.md`](.claude/testing.md) |
| touch scripts, tooling or lint config | [`.claude/node.md`](.claude/node.md), [`.claude/linting.md`](.claude/linting.md) |
| add a construct | [`.claude/architecture.md`](.claude/architecture.md) |
| copy or port code in | [`.claude/licensing.md`](.claude/licensing.md) |
| work in `std/crypto`, `std/net` or `docs/security/` | [`docs/security/README.md`](docs/security/README.md) |
| write a *program* in Nish | [`docs/AI.md`](docs/AI.md), then [`docs/guide/`](docs/guide/index.md) |
| pick up a work package ("pick up WP50", `/feature --next`) | its parent issue under the [Roadmap issue](https://github.com/amritk/nish/issues/1849), its plan `.claude/plans/<slug>.plan.md`, [`AGENTS.md`](AGENTS.md#picking-up-a-work-package) → "Picking up a work package", and the `pickup` skill; the PR `Fixes` the stage's issue |
| change a workflow skill or agent (`feature`, `plan-issues`, `pickup`, `decide`, the reviewers) | they are the `ai` plugin (`ai@amritk`, enabled in `.claude/settings.json`), from [`amritk/ai`](https://github.com/amritk/ai): change them there, not here |

**An untyped emit-ts walk knows nothing.** In `src/emit-ts-*.ts`, read
types only through `walk.typeAt`, and treat a null binding table
(`nodeCallees`, `nodeLocals`, ...) under `walk.untyped` as unknown:
call `walk.missType()`, never take the "not bound" branch.

## Definition of done

Locally, before pushing: `npm run check`, `npm run lint`, and
`node tests/run.js <filter>` for every section or program the change touches
(plus the `src/` runs below). **The full-suite gate is CI**: every
`test (…, shard N/9)` row green on the current head, each shard's summary read
for its skip count like a local run (`AGENTS.md` → "Trusting a test run"). Run
the whole `npm test` locally only when the change is to the suite itself
(`tests/run.js`'s structure, `tests/pool.js`) or CI cannot answer (a fork PR),
and say so in the PR body.

**`npm run lint` is not CI's lint job.** Before pushing, also run
`npm run lint:dead` and `node docs/check-links.mjs` (the job's full list is in
`.github/workflows/ci.yml`). knip fails on an export your change leaves unused,
and the link check fails when a renamed heading breaks an anchor in a file you
never opened; `npm run lint` passes both.

A change to `std/` or `src/` that moves any nish-cmp corpus program's IR adds
narrow `DECLARED` entries to `tests/nish-cmp.js` (program + file, the PR's
release-note words) in the same PR; run nish-cmp before pushing.

**`std/` line moves and panic proofs are pinned.** An edit that adds or
removes lines in a `std/*.ts` file moves every `std/<file>.ts:LINE:COL` in
`tests/link/*/expected.caps.json`, `tests/wordings/*.err` and
`docs/reference/diagnostics/`: grep `std/<file>.ts:[0-9]` and regenerate them
from the compiler's output in the same PR. A `nish:simd` access whose
lanes `bounds.ts` proves in range is recorded as a proven index site and an
unguarded one as unproven (`src/attributes.ts`), so `std/` code a
`--deny-panics` caller can reach uses only guarded ones.

A new diagnostic code lands with a `tests/link` negative that provokes it
(an `expected.err`): inline `tests/run.js` checks do not count toward "every
registry code is provoked". A changed diagnostic message is grepped across
the whole repo (`expected.err`, `expected.json`, the pinned negative cases)
before pushing.

**A record states only what its code or its recorded run does.** In
`docs/security/*.md` and `docs/BENCHMARKS.md`, check each "only", "cannot"
and "never" against the code's real match (a seccomp row matches syscall
numbers, not descriptors), and each route, figure and command against what
was run. Every `docs/BENCHMARKS.md` table names the commit whose bench code
produced it and claims only the fields that version prints. A per-second
maximum is quoted as a maximum, never as a typical cost. Each "up to",
"every" or "lower than" is checked against the table it summarises.

A public declaration of `std/` or `runtime/nish.d.ts` lands with a doc
comment, a `@param` per parameter and a `@returns` for a non-`void` return:
`node scripts/gen-reference.mjs --check` fails on any gap
`scripts/undocumented.txt` does not list, and that list only shrinks.

A new construct ships with a golden `.ll`, an `llvm-as` pass, a native round
trip with expected stdout, at least one negative test, its
`docs/LANGUAGE.md` rule, cookbook entry and user-guide page — the checklist is
`docs/ARCHITECTURE.md` → "How to add a construct". Show the exact LLVM IR for
every TypeScript snippet a PR adds to the tests. Copied code keeps its upstream
notice and is listed in `THIRD_PARTY_NOTICES.md`.

**Attacker-facing code ships with its security record.** A new `std/net` or
`std/crypto` module, `runtime/*.c` file, or builtin or `nish:` module that reads
the network, the terminal or another process lands with its `docs/security/`
record (scope, findings fixed with a before/after test or recorded open) and
its index row, in the same PR. `node scripts/security-scope.mjs` refuses a file
no record's scope names; its "Not yet audited" list only shrinks.

**The user guide moves with the language.** A change a user of Nish sees — a
construct, a builtin or `nish:` module, a `std/` module, a CLI flag or exit
code, an install step, a diagnostic a guide page shows — updates its
`docs/guide/` page in the same PR (a new topic gets a page and a route in
`scalar.config.json`). Internal changes do not. Page rules:
[`docs/README.md`](docs/README.md#writing-a-guide-page).

**Read a check's exit status, never its piped tail.** `npm run lint | tail`
reports success when lint fails. Run it bare, or check `$?` / `PIPESTATUS`.

**There is one compiler, in `src/`, built by the seed** (the last release, in
`build/seed/`). `src/` may not *use* a new construct or builtin until the next
release ships it — the rolling freeze, checked by CI's `bootstrap` job. Run
`bash scripts/fetch-seed.sh --force` if the seed may be stale. A change to
`src/` also runs `node tests/run.js wasi` and `node tests/run.js performance`
before it is pushed (read the `wasi` skip line; it needs
`WASI_SYSROOT=/usr`): a new index in `src/` the prover cannot discharge is an
NL9007 warning, and that run's ratchet fails on it. A change to `runtime/*.c`
runs `node tests/run.js c-symbols`, which fails on a new libc call until
`src/c-symbols.ts` reserves it (`.claude/selfhost.md` →
["Changing the runtime"](.claude/selfhost.md#changing-the-runtime)).

**CI's runners are not this container.** A spawn or sandbox check in
`tests/run.js` runs on ubuntu with uutils coreutils and with descriptors the
runner hands node: it proves behaviour by the exit status of a helper it
builds, never by a tool's message text or the test process's own descriptor
count ([`.claude/testing.md`](.claude/testing.md#checks-that-spawn-a-process)).

**Generated goldens are regenerated, never edited or merged by hand.**
`tests/self/goldens/checked/` (one file per module) moves with any change to
`src/`, `std/` or a positive `tests/cases/*.ts`: rewrite it with
`node tests/self/goldens.js --update` (`--seed build/seed/bin/nish` without
`build/nish`) and read the diff. To take in `main`, run `npm run sync-main`: it
merges, regenerates the goldens and stages them without committing. Sync after
any `src/` or `std/` change lands on `main`, even with no textual conflict.
A sync can stale a fact the branch pins without a conflict: after it, run
`node scripts/gen-diagnostic-codes.mjs --check` (a code the branch adds may now
be taken). A
new positive `tests/cases/*` is registered with
`node tests/differential/goldens.js --update` in the same commit. Details:
`.claude/selfhost.md` → "The goldens". `docs/reference/` (and its routes in
`scalar.config.json`) moves with any change to `std/`, `runtime/nish.d.ts` or
`docs/LANGUAGE.md`: rewrite it with `node scripts/gen-reference.mjs`; CI's
`--check` fails on a stale, extra or hand-edited page
([`docs/README.md`](docs/README.md#the-library-reference)).

**The emit-ts known list is Node-version-specific.** Regenerate
`tests/differential/emit-ts-known.txt` only under the Node that
`.github/workflows/ci.yml` pins; another minor flipped a verdict
(`str_surrogate_pair`) and turned CI red.

**A CI lane reads what its commands read.** Before `scripts/ci-scope.mjs`
lets a side job skip, trace every step of that job, composite actions
included, to the files it opens; a job that runs `node tests/run.js` reads
all of `tests/`. The backtest only evidences lanes whose jobs failed in its
sample, so a narrowed read set needs a per-command test in
`node tests/run.js ci-scope`, not a replay (`docs/wp10-ci.md`, "Scoped
lanes").

**Moving where a fact lives moves every pointer to it in the same PR.** Grep
the docs, `.claude/`, `CLAUDE.md` and source comments for the old location.
A builtin whose answer changes greps its old answer across
`docs/LANGUAGE.md`, `docs/guide/` and `runtime/nish.d.ts`. A security record
whose counts change updates its row in `docs/security/README.md`.

## Spending tokens

Every call re-reads the whole context, so cost is context size × calls.

- **One deliverable per session.** Asked for a new, separate one after
  shipping, offer a short handoff for a fresh session instead.
- **CI runs the full suite, not the session.** Unsharded, `npm test` takes 40
  to 70 minutes in a 4-core cloud session; CI's `test` job runs all of it in
  nine cost-dealt shards on every push (about 10 minutes wall). Run the
  targeted sections in the [definition of done](#definition-of-done) and let
  the shards answer for the rest.
- **Wait for a long run without polling.** Commit first, start it once in the
  background with output to a file, and end the turn. No `sleep` loops, no
  scheduled check-ins, never two runs at once (they share `build/`).
- **Merge `main` only on a conflict or just before merging.**
- **Wide reads go to a subagent** (`Explore`, `model: "sonnet"`). Read files
  by range and never re-read one already in context.

## Security

Report vulnerabilities privately ([`SECURITY.md`](SECURITY.md)). **Secret
material in `std/crypto` is a `Secret` and is wiped**: a function holding a
private key or secret intermediate takes and gives it as `Secret<T>`
(`nish:secret`), computes inside `expose`, and `wipe`s every intermediate
before it returns — a volatile store `tests/run.js` pins under `-O2`
("nish:secret: the wipe survives opt -O2"). What a wipe cannot reach is
recorded in its area's record.
**Code that decides what a package may grant fails closed.** Anything that
reads package-controlled input to decide whether to ask (skill frontmatter,
names, file trees) uses an allowlist of what is inert and treats everything
else, including whatever it cannot parse, as a grant. No length cap may drop
a distinct grant from what the user is asked about (`scripts/link-skills.mjs`,
SC-35 in [`docs/security/supply-chain.md`](docs/security/supply-chain.md)).
Record format and review scope: [`docs/security/README.md`](docs/security/README.md#writing-a-record).

## Git & PR Guidelines

NEVER include session links, tracking IDs, model names or platform
attributions in commits, code or PR text.

- Before starting on an issue, search open PRs for it; put `Fixes #N` in the
  first push.
- **A PR goes up finished and you squash-merge it yourself** once CI is green
  on the current head, nothing conflicts, and no human requests changes or
  holds an open thread. Until then, watch it and fix what is red. A PR that
  conflicts with `main` gets no CI at all — check mergeability first.
- **Never merge the Release PR** (`chore(release): <version>` on
  `release/next`): merging it publishes to npm.
- The five conditions in full:
  [`AGENTS.md`](AGENTS.md#shipping-a-change-what-a-pull-request-must-be-and-who-merges-it).

**Commit messages are the changelog** (`scripts/changelog-gen.mjs`): the
subject is the `CHANGELOG.md` line, the body its prose in the release notes.

```
type(scope): imperative subject

What changed, and why this way, for a reader of the release notes.

Measured: 1.58x on an element loop
Refs: docs/IR_COOKBOOK.md#arrays
Tests: tests/cases/arr_alias_domains
```

- **type**: `feat` (minor bump) or `fix` `perf` `refactor` `docs` `test`
  `build` `ci` `chore` (patch). **scope**: `checker`, `codegen`, `runtime`,
  `self`, `cli`, `interop`.
- `type!` or `BREAKING CHANGE:` marks a break, which moves the minor: **the
  project stays on 0.x** — never propose or cut 1.0.0, never add
  `Release-As:`.
- `Measured:` states the figures and their noise band
  (`.claude/testing.md` → "A `Measured:` trailer"). `Release-Note:` replaces
  the body in public notes.
- Only conventional subjects become entries; `pr-title.yml` checks the PR
  title, which a squash merge lands.
- **A squash subject keeps the PR's release-note words.** `tests/nish-cmp.js`
  `DECLARED` entries match their `changelog` text against `CHANGELOG.md` and
  the pending notes, so the subject must contain every `changelog:` string
  the PR adds, verbatim: read them from the diff before writing it.
