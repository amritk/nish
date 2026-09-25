# Project rules

**New session? Read [`.claude/orientation.md`](.claude/orientation.md) first** —
it is the ninety-second map of the repository, the compiler, the seed that
builds it, and the commands. If the work touches the compiler — `self/` —
read [`.claude/selfhost.md`](.claude/selfhost.md) straight after it.

Writing a *program* in Nish rather than working on the compiler? That is
[`docs/AI.md`](docs/AI.md) — the whole language as rules in one pass, every
example compiled by `npm test`.

Developer guidelines live in the `.claude/` directory:

- **orientation.md** — start here: what the repo is, where the code is, what to run
- **selfhost.md** — the `self/` compiler: Nish-0, the seed, the module map, how it is tested
- **node.md** — Node runtime, npm scripts, the LLVM toolchain, Biome
- **typescript.md** — TypeScript style: the Nish rules for every program in the repo, the compiler included, and the static-friendly rules for the JavaScript tooling
- **comments.md** — Comment guidelines and JSDoc
- **testing.md** — The golden-test harness, what every construct ships with
- **architecture.md** — The pipeline, the rules that shape every change, where to read next
- **licensing.md** — Third-party code: what counts as a copy, the notice it keeps, the licences allowed

> **Agents: read every file in `.claude/` before writing any code.** The rules
> there are authoritative — if generated code violates them, that is a mistake
> regardless of whether the user points it out.

## Definition of done

`npm run check` (an ambient `tsc --noEmit` over `self/`, `std/` and
`tests/nish/` against `runtime/nish.d.ts`) and an undegraded `npm test` green.
A new construct ships with a golden `.ll`, an `llvm-as` pass, a native round
trip with expected stdout, at least one negative test, its `docs/LANGUAGE.md`
rule and cookbook entry, and a line in `CHANGELOG.md` — see
`docs/MASTER_PLAN.md` §7 and the checklist in `docs/ARCHITECTURE.md`. Show the
exact LLVM IR for every TypeScript snippet a PR adds to the tests. Code copied,
ported or adapted from elsewhere keeps its upstream notice and is listed in
`THIRD_PARTY_NOTICES.md` ([`.claude/licensing.md`](.claude/licensing.md)).

**There is one compiler, and a construct is written once, in `self/`.** The
TypeScript implementation that used to sit beside it in `src/` was deleted in
WP19 R6 (`docs/wp19-stage0-retirement.md`). `self/` is built by the last
released `nish` — the seed, which `scripts/fetch-seed.sh` puts in `build/seed/`
— so `self/` may not *use* a new construct in its own source until the next
release: the rolling freeze, which CI's `bootstrap` job checks by building
`self/` with that release.

## Git & PR Guidelines

NEVER include Claude session links, tracking IDs, model names, or platform
attributions in commits, code, or PR text. Keep all PR descriptions strictly
focused on the code changes.

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
  `Refs:` and `Tests:` link the rule and the golden that pins it.
- **`Release-Note:`** replaces the body in public notes, for when the body is
  about the review rather than about the change.

Only conventional subjects become release entries. A subject that is not one
is skipped and named on stderr, so a change worth reading about has to say what
it was — which is why `pr-title.yml` checks the pull request title, the subject
a squash merge lands. Work-in-progress commits behind a merge therefore cost
nothing; `--include-unconventional` files them all under "Uncategorised" when a
release really needs the raw history.
