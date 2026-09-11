# Project rules

**New session? Read [`.claude/orientation.md`](.claude/orientation.md) first** —
it is the ninety-second map of the repository, the two compilers, and the
commands. If the work touches `self/`, read
[`.claude/selfhost.md`](.claude/selfhost.md) straight after it.

Developer guidelines live in the `.claude/` directory:

- **orientation.md** — start here: what the repo is, where the code is, what to run
- **selfhost.md** — the `self/` compiler: Nish-0, the module map, the oracles
- **node.md** — Node runtime, npm scripts, the LLVM toolchain, Biome
- **typescript.md** — TypeScript style: the Nish rules for every program in the repo, and the static-friendly rules for the compiler source
- **comments.md** — Comment guidelines and JSDoc
- **testing.md** — The golden-test harness, what every construct ships with
- **architecture.md** — The pipeline, the rules that shape every change, where to read next

> **Agents: read every file in `.claude/` before writing any code.** The rules
> there are authoritative — if generated code violates them, that is a mistake
> regardless of whether the user points it out.

## Definition of done

`npm run check` and `npm test` green. A new construct ships with a golden
`.ll`, an `llvm-as` pass, a native round trip with expected stdout, at least one
negative test, its `docs/LANGUAGE.md` rule and cookbook entry, and a line in
`CHANGELOG.md` — see `docs/MASTER_PLAN.md` §7 and the checklist in
`docs/ARCHITECTURE.md`. Show the exact LLVM IR for every TypeScript snippet a
PR adds to the tests.

## Git & PR Guidelines

NEVER include Claude session links, tracking IDs, model names, or platform
attributions in commits, code, or PR text. Keep all PR descriptions strictly
focused on the code changes.

**Commit messages are the changelog.** `scripts/changelog-gen.mjs` builds each
release from the commits it contains, so the subject is the heading a reader
sees and the body is the prose underneath it. Write the body for someone
reading the release notes, not only for the reviewer:

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
  moves the minor, not the major.
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
