# Project rules

**New session? Read [`.claude/orientation.md`](.claude/orientation.md) first** —
it is the ninety-second map of the repository, the compiler, the seed that
builds it, and the commands. If the work touches the compiler — `src/` —
read [`.claude/selfhost.md`](.claude/selfhost.md) straight after it.

Writing a *program* in Nish rather than working on the compiler? That is
[`docs/AI.md`](docs/AI.md) — the whole language as rules in one pass, every
example compiled by `npm test`.

Developer guidelines live in the `.claude/` directory:

- **orientation.md** — start here: what the repo is, where the code is, what to run
- **selfhost.md** — the compiler in `src/`: Nish-0, the seed, the module map, how it is tested, the files a new builtin touches, and the lines `tests/run.js`'s mutation checks need byte-identical
- **node.md** — Node runtime, npm scripts, the LLVM toolchain, Biome
- **linting.md** — What the linters enforce and why: kebab-case files, camelCase names, the Biome rule set, knip and the format hook
- **typescript.md** — TypeScript style: the Nish rules for every program in the repo, the compiler included, and the static-friendly rules for the JavaScript tooling
- **comments.md** — Comment guidelines and JSDoc
- **testing.md** — The golden-test harness, what every construct ships with
- **architecture.md** — The pipeline, the rules that shape every change, where to read next
- **licensing.md** — Third-party code: what counts as a copy, the notice it keeps, the licences allowed

> **Agents: read every file in `.claude/` before writing any code.** The rules
> there are authoritative — if generated code violates them, that is a mistake
> regardless of whether the user points it out.

## Definition of done

`npm run check` (an ambient `tsc --noEmit` over `src/`, `std/` and
`tests/nish/` against `runtime/nish.d.ts`) and an undegraded `npm test` green.
A new construct ships with a golden `.ll`, an `llvm-as` pass, a native round
trip with expected stdout, at least one negative test, its `docs/LANGUAGE.md`
rule and cookbook entry, and a conventional commit whose subject and body are
its changelog entry (`CHANGELOG.md` is generated from them; see below) — see
`docs/MASTER_PLAN.md` §7 and the checklist in `docs/ARCHITECTURE.md`. Show the
exact LLVM IR for every TypeScript snippet a PR adds to the tests. Code copied,
ported or adapted from elsewhere keeps its upstream notice and is listed in
`THIRD_PARTY_NOTICES.md` ([`.claude/licensing.md`](.claude/licensing.md)).

**A rule that lets a value outlive its scope pins what it leaves out.** An
escape-analysis rule that lets a value travel with a container says which
element types it covers, and pins the excluded ones with a negative golden run
after `churn()`: #520's second review round reproduced a use-after-free through
`string[][]` that every reading review had missed. Narrowing such a rule
regenerates every golden the wider rule moved, not only the new cases — #520's
`perf_alloc_quiet.ll` kept the wider rule's release and turned CI red.

**There is one compiler, and a construct is written once, in `src/`.** The
TypeScript implementation that used to sit beside it, stage0, was deleted in
WP19 R6 (`docs/wp19-stage0-retirement.md`). `src/` is built by the last
released `nish` — the seed, which `scripts/fetch-seed.sh` puts in `build/seed/`
— so `src/` may not *use* a new construct in its own source until the next
release: the rolling freeze, which CI's `bootstrap` job checks by building
`src/` with that release. `fetch-seed.sh` keeps whatever seed is already there,
so a session that may hold an older one runs `bash scripts/fetch-seed.sh
--force` before building: a 0.16.0 seed against `main`'s 0.18.0 made `fuzz
--stage1` disagree on a clean `main` (#541, #540). `src/` is also linked whole
into the web compiler's wasi module, and the performance ratchet allows no new
NL9007 in it, so a change to `src/` runs `node tests/run.js web` and `node
tests/run.js performance` before it is pushed: #546 called builtins refused on
wasm32 and #550 added an unproven index, both green on every local check and
red in CI.

**Generated goldens are regenerated, never edited or merged by hand.**
`tests/self/goldens/checked.txt` and `checked-self.txt` are stage1's
`--emit-checked` dump of the golden cases and of `src/`, so any change to
`src/`, to `std/` or to a positive `tests/cases/*.ts` moves them, and every
`src/` commit on `main` conflicts with every open pull request that touches
`src/`. A plan stage that changes `src/` or `std/` therefore owns these goldens
too (#532 regenerated `checked.txt` outside its declared files). Rewrite
them only with `node tests/self/goldens.js --update` (add
`--seed build/seed/bin/nish` when `build/nish` is not built) and read the diff
before committing it. On a conflict, merge `main` in and regenerate rather
than resolving lines ([`AGENTS.md`](AGENTS.md#shipping-a-change-what-a-pull-request-must-be-and-who-merges-it),
[`.claude/selfhost.md`](.claude/selfhost.md)). When another `src/` or `std/`
pull request lands first, merge `main` and regenerate even if git reports no
conflict, and merge only once CI is green on that head: the goldens and the
`.ll` the two changes share move without a textual conflict (#549 after #547).
A new positive `tests/cases/*` is registered with `node
tests/differential/goldens.js --update` in the same commit, or `differential:
the frozen rewrites` fails (#548).

## Security

Vulnerabilities are reported privately, as [`SECURITY.md`](SECURITY.md) says,
and each audited area keeps its record under
[`docs/security/`](docs/security/README.md). A record states the commit its
`file:line` anchors are at; a row rewritten after that base names the commit
its own anchors are at, rather than moving them silently (#529, CG-5).

**Secret material in `std/crypto` is a `Secret` and is wiped.** `nish:secret`
(docs/LANGUAGE.md, "Secrets") is the primitive: a function that holds a
private key, a secret scalar or another secret intermediate takes and gives
the key as a `Secret<T>`, computes on it inside `expose`, and `wipe`s every
intermediate before it returns — a volatile store `tests/run.js` pins under
`-O2` ("nish:secret: the wipe survives opt -O2"). What a wipe cannot reach (a
scalar in a register, an immutable string) is recorded in its area's record,
as ECC-2 and X509-7 do. `std/` may use `nish:secret` now; `src/` only from the
release that ships it (the rolling freeze).

## Git & PR Guidelines

NEVER include Claude session links, tracking IDs, model names, or platform
attributions in commits, code, or PR text. Keep all PR descriptions strictly
focused on the code changes. A cloud session can have a footer with a session
link appended to a pull request's body after you write it, so read the body
back once the pull request is open and delete any such footer: `pr-body.yml`
fails the pull request until you do.

Before starting on an issue, search the open pull requests for it, and put
`Fixes #N` in the first push: two parallel runs both fixed #524 (#534 and
#536), and one had to be thrown away.

**A pull request goes up finished, and you merge it yourself.** Fully tested
(`npm run check` and an **undegraded** `npm test` — read the skip count, not
just the exit code) and clear of conflicts with `main` before you open it. Once
CI is green on the *current* head, no conflict remains, and no human is
requesting changes or holding an unresolved thread, **squash-merge it** rather
than waiting to be asked. Until then, do not stop and do not ask: watch the
pull request, fix the red check, resolve the conflict, answer the review, and
merge when it gets there.

The one exception is the **Release PR** — `chore(release): <version>` on
`release/next`. Merging it tags and publishes to npm, so it stays a human's
decision however green it is. Never merge it.

[`AGENTS.md`](AGENTS.md#shipping-a-change-what-a-pull-request-must-be-and-who-merges-it)
states the five conditions in full.

**Commit messages are the changelog.** `scripts/changelog-gen.mjs` builds each
release from the commits it contains, so the subject is the line a reader sees
in `CHANGELOG.md` and in the release notes, and the body is that entry's prose
in `changelog/<version>.json` — the record the website renders. Write the body
for someone reading the release notes, not only for the reviewer:

```
type(scope): imperative subject

The explanation, in prose and in Markdown. What changed, and why this
way rather than another.

Measured: 1.58x on an element loop
Refs: docs/IR_COOKBOOK.md#arrays
Tests: tests/cases/arr_alias_domains
```

- **type** is one of `feat` `fix` `perf` `refactor` `docs` `test` `build` `ci`
  `chore`, and decides both the heading and the version bump: `feat` moves the
  minor, everything else the patch.
- **`type!`** or a `BREAKING CHANGE:` trailer marks a break. Before 1.0 that
  moves the minor, not the major. **The project stays on 0.x until its owner
  says otherwise**: do not propose, plan towards or cut 1.0.0, and do not add a
  `Release-As:` trailer. The stability rule at the head of `docs/LANGUAGE.md`
  says what a break in the language is, now and after 1.0.
- **scope** is the part of the compiler — `checker`, `codegen`, `runtime`,
  `self`, `cli`, `interop` — and is what the website filters on.
- **`Measured:`** carries a number, because this project's claims are measured.
  It states the figures themselves: a trailer that points at the pull request
  body loses them, because the body is not the changelog. Time a loop whose
  input changes on every iteration and whose output is folded into a printed
  checksum, or the optimiser may compute the answer once and time nothing.
  State the noise band too — the baseline timed against a byte-identical copy
  of itself in the same interleaved rounds — and read every delta against it:
  "faster", or "none faster", is claimed only outside that band (#538).
  `Refs:` and `Tests:` link the rule and the golden that pins it.
- **`Release-Note:`** replaces the body in public notes, for when the body is
  about the review rather than about the change.

Only conventional subjects become release entries. A subject that is not one
is skipped and named on stderr, so a change worth reading about has to say what
it was — which is why `pr-title.yml` checks the pull request title, the subject
a squash merge lands. Work-in-progress commits behind a merge therefore cost
nothing; `--include-unconventional` files them all under "Uncategorised" when a
release really needs the raw history.
