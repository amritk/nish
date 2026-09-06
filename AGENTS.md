# AGENTS.md

Guidance for AI coding agents (Cursor, Copilot, Claude Code, …) working **in
this repository**. For Claude Code the same rules live in
[`CLAUDE.md`](./CLAUDE.md); the detailed developer guidelines are in
[`.claude/`](./.claude/) — read the one that matches your task:

- [`.claude/architecture.md`](./.claude/architecture.md) — the pipeline, the rules that shape every change, where to read next
- [`.claude/typescript.md`](./.claude/typescript.md) — TypeScript style: the StaticTS rules for every program in the repo, and the static-friendly rules for the compiler source
- [`.claude/node.md`](./.claude/node.md) — Node runtime, npm scripts, the LLVM toolchain, Biome
- [`.claude/testing.md`](./.claude/testing.md) — the golden-test harness, what every construct ships with
- [`.claude/comments.md`](./.claude/comments.md) — comment and JSDoc guidelines

## What this is

`statictsc` (**StaticTS**) is an ahead-of-time compiler from a strictly static
subset of TypeScript to LLVM IR, published to npm as a single package. It is a
**Node.js + npm** project with one runtime dependency (`typescript`); the
sibling repos' Bun rules do not apply here. The reference documents are
[`docs/LANGUAGE.md`](./docs/LANGUAGE.md) (what the language is) and
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (how the compiler is put
together); [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md) is the work-package
plan, with the conventions every agent follows in §7 and a brief template in §8.

## Workflow

```bash
npm install                 # install (npm ci in CI)
npm run check               # tsc --noEmit
npm test                    # build + the full suite (goldens, llvm-as, native, runtime, differential)
node tests/run.js <sub>     # only cases whose name contains <sub>
npm run test:update         # write missing .ll goldens for new cases
npm run lint                # biome, advisory
npm run smoke               # build and run every example with a main
```

Most of `npm test` needs LLVM 18 on `PATH` (`clang`, `llc`, `llvm-as`, `opt`,
`ld.lld`, `wasm-ld`); without it the toolchain-dependent checks are skipped,
not failed, so a green run without LLVM proves less than it looks. Install
steps per OS are in [`docs/INSTALL.md`](./docs/INSTALL.md).

## House rules

- **`npm test` must be green**, and every new construct ships with a golden
  `.ll`, an `llvm-as` pass, a native round trip with expected stdout, at least
  one negative test, its `docs/LANGUAGE.md` rule and cookbook entry, and a
  `CHANGELOG.md` line. There is no changesets flow here; the changelog is the
  record.
- **Never emit an LLVM attribute you cannot cite a checker proof for.** Write
  the reason in `src/codegen/attributes.ts` beside the code.
- **A struct layout change touches `runtime.ts` and `runtime.c` in the same
  commit** and extends a layout test. Keep `runtime.c` within its budget and
  report its size in the PR.
- **Do not widen scope into another work package's files**; leave a
  `TODO(WP<n>)` instead.
- **Never** put Claude/session links, tracking IDs, model names or platform
  attributions in commits, code, or PR text. Commit messages: imperative
  subject, body explaining the lowering.
- Match the surrounding code's style, comment density, and naming. Biome
  (`biome.json`) is the formatter and linter, run with the formatter disabled
  in `npm run lint`; keep new files formatted and do not reformat files you did
  not otherwise change.
- Show the exact LLVM IR for every TypeScript snippet a PR adds to the tests.
