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
focused on the code changes. Commit messages: imperative subject, body
explaining the lowering.
