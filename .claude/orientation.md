# Orientation — read this first

Ninety seconds to a working mental model of the repository. Everything here is
a pointer; the authority is the document each line names.

## What the repository is

Two compilers for one language.

| | Source | Written in | Built by | Role |
| --- | --- | --- | --- | --- |
| **stage0** | `src/` | TypeScript on Node, parsing with the `typescript` package | `tsc` into `dist/` | the shipped compiler, the bootstrap seed, and the oracle |
| **stage1** | `self/` | AmritScript (the language itself) | stage0 | the self-hosted compiler; it compiles itself to a fixed point |

`amritc` compiles a strictly static subset of TypeScript to textual LLVM IR.
The pipeline is parse → validate (Phase 0) → check (signatures, then bodies) →
emit, and the shape is the same on both sides.

`self/` compiles `self/` to a byte-identical fixed point today
(`docs/wp14-selfhost.md`, milestone S5), and `npm test` proves it on every run.
Read [`selfhost.md`](./selfhost.md) next if you are touching `self/`,
`tests/self/`, `tests/lexer_oracle.js` or `tests/parser_oracle.js`.

## The six things that are always true

1. **The checker records, the emitter reads.** Side tables carry every fact the
   emitter needs; the emitter never re-derives a type and never reports a user
   error (an unexpected node there is exit 70). `src/checker/program.ts`,
   `self/program.ts`.
2. **Dispatch, not `if` chains.** stage0 uses tables keyed by `ts.SyntaxKind`;
   stage1 uses a central `switch` on the node kind (`docs/wp14-selfhost.md`
   §3a D2). A construct is an entry in each layer, mirrored.
3. **No attribute without a proof.** `src/codegen/attributes.ts` may only emit
   an LLVM attribute the whole-program fixpoint justifies, with the reason
   written beside it.
4. **Layout changes are two-sided.** A struct layout lives in
   `src/codegen/runtime.ts` *and* `runtime/runtime.c` / `runtime/amritc.h`;
   they change together and `tests/run.js` fails when they disagree.
5. **The name lives in two files.** `src/branding.ts` and `self/branding.ts`
   are the only source files that spell the project's name; every string the
   compiler prints builds it from `LANGUAGE` / `CLI` there. The `amrit_` prefix
   on the runtime's C symbols is ABI, not branding: it is frozen and a rename
   does not follow it.
6. **`docs/LANGUAGE.md` is normative.** The `docs/wp*.md` notes are historical;
   where they disagree, LANGUAGE.md wins.

## Where the code is

```
src/                the stage0 compiler
  index.ts          CLI: flags, output planning, exit codes
  compilation.ts    one program: load, check, emit, sidecars
  parser.ts validator.ts types.ts diagnostics.ts dump.ts
  checker/          pass 1 signatures, pass 1b imports, pass 2 bodies
  codegen/          ir.ts, runtime.ts, target.ts, escape.ts, attributes.ts,
                    debug.ts, emitter.ts, emit/<family>.ts
  interop/          C header, wasm .d.ts, N-API shim
self/               the stage1 compiler, in AmritScript — see .claude/selfhost.md
runtime/            runtime.c, amritc.h, runtime_wasm.c, shim.mjs
tests/              run.js + cases/ (goldens), link/, ir/, layout/,
                    differential/, self/ (the stage1 oracles)
docs/               LANGUAGE, ARCHITECTURE, IR_COOKBOOK, MASTER_PLAN, wp*.md
```

## Commands

```bash
npm ci                      # install
npm run check               # tsc --noEmit
npm test                    # build + the whole suite (~3 min with LLVM)
node tests/run.js <sub>     # only checks whose name contains <sub>
node tests/run.js self      # the WP14 self-hosting section alone
npm run test:update         # write missing .ll goldens
npm run bootstrap           # build the self-hosted compiler (build/amritc)
npm run lint                # biome, advisory, never a compile gate
```

`npm test` needs LLVM 18 on `PATH` (`clang`, `llc`, `llvm-as`, `opt`, `ld.lld`,
`wasm-ld`). Without it the toolchain-dependent checks **skip rather than fail**,
so a green run without LLVM proves much less than it looks.

## Definition of done

`npm run check` and `npm test` green, and a new construct ships with a golden
`.ll`, an `llvm-as` pass, a native round trip with expected stdout, at least one
negative test, its `docs/LANGUAGE.md` rule and cookbook entry, and a
`CHANGELOG.md` line.

## Where to read next

| Question | Document |
| --- | --- |
| I am working on `self/` | [`selfhost.md`](./selfhost.md) |
| When does stage0 go away? | `docs/wp18-stage0-retirement.md` |
| How do I add a construct? | `docs/ARCHITECTURE.md` → "How to add a construct" |
| What does the language allow? | `docs/LANGUAGE.md` |
| What IR does X compile to? | `docs/IR_COOKBOOK.md` |
| How do I write the code? | [`typescript.md`](./typescript.md) |
| How do I test it? | [`testing.md`](./testing.md) |
| What is the plan? | `docs/MASTER_PLAN.md`, `docs/wp14-selfhost.md` |
