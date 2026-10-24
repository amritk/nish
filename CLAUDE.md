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

## Definition of done

`npm run check` and an undegraded `npm test` green (read the skip count, not
just the exit code). A new construct ships with a golden `.ll`, an `llvm-as`
pass, a native round trip with expected stdout, at least one negative test, its
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
`WASI_SYSROOT=/usr`).

**Generated goldens are regenerated, never edited or merged by hand.**
`tests/self/goldens/checked/` (one file per module) moves with any change to
`src/`, `std/` or a positive `tests/cases/*.ts`: rewrite it with
`node tests/self/goldens.js --update` (`--seed build/seed/bin/nish` without
`build/nish`) and read the diff. To take in `main`, run `npm run sync-main`: it
merges, regenerates the goldens and stages them without committing. Sync after
any `src/` or `std/` change lands on `main`, even with no textual conflict. A
new positive `tests/cases/*` is registered with
`node tests/differential/goldens.js --update` in the same commit. Details:
`.claude/selfhost.md` → "The goldens".

**Moving where a fact lives moves every pointer to it in the same PR.** Grep
the docs, `.claude/`, `CLAUDE.md` and source comments for the old location.

## Spending tokens

Every call re-reads the whole context, so cost is context size × calls.

- **One deliverable per session.** Asked for a new, separate one after
  shipping, offer a short handoff for a fresh session instead.
- **The full `npm test` (40–70 min) runs twice per pull request**: before
  opening it, and after the last merge of `main`. In between, run
  `node tests/run.js <section>`, `npm run check` and `npm run lint`.
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
