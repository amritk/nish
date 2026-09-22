# Orientation — read this first

Ninety seconds to a working mental model of the repository. Everything here is
a pointer; the authority is the document each line names.

## What the repository is

One compiler, written in the language it compiles.

| | Source | Written in | Built by | Role |
| --- | --- | --- | --- | --- |
| **the compiler** | `self/` | Nish (the Nish-0 subset of the language itself) | the **seed**: the last released `nish` | the only implementation; it compiles itself to a fixed point |

`nish` compiles a strictly static subset of TypeScript to textual LLVM IR.
The pipeline is lex → parse → validate (Phase 0) → check (signatures, then
bodies) → emit.

The seed works the way rustc's and Go's do: the previous release builds
stage1, stage1 builds stage2, and stage3 must be byte-identical to stage2.
`scripts/fetch-seed.sh` downloads the last release into `build/seed/`, and
`NISH_BOOTSTRAP=<path>` names another. Until WP19 R6 a second implementation in
TypeScript (`src/`, "stage0", built by `tsc` into `dist/`) was the seed and the
oracle; it is deleted, and `docs/wp19-stage0-retirement.md` records what
replaced each thing it did. Read [`selfhost.md`](./selfhost.md) next: every
change to the compiler is a change to `self/`.

## The seven things that are always true

1. **The checker records, the emitter reads.** Side tables carry every fact the
   emitter needs; the emitter never re-derives a type and never reports a user
   error (an unexpected node there is exit 70). `self/program.ts`.
2. **Dispatch, not `if` chains.** A central `switch` on the node kind in each
   layer (`docs/wp14-selfhost.md` §3a D2). A construct is an entry in each
   layer, mirrored.
3. **No attribute without a proof.** `self/attributes.ts` may only emit an LLVM
   attribute the whole-program fixpoint justifies, with the reason written
   beside it.
4. **Layout changes are two-sided.** A struct layout lives in
   `self/runtime.ts` *and* `runtime/runtime.c` / `runtime/nish.h`; they change
   together and `tests/run.js` fails when they disagree.
5. **The name lives in one file.** `self/branding.ts` is the only source file
   that spells the project's name; every string the compiler prints builds it
   from `LANGUAGE` / `CLI` there. The `nish_` prefix on the runtime's C symbols
   is ABI, not branding: it is frozen and a rename does not follow it.
6. **`docs/LANGUAGE.md` is normative.** The `docs/wp*.md` notes are historical;
   where they disagree, LANGUAGE.md wins.
7. **The machine-readable surfaces are contracts.** `--help` answers on stdout
   with exit 0 (a usage *error* is stderr and exit 2); `--json` prints one flat
   object per diagnostic whose `code` is a stable rule identifier, and every
   failure — toolchain and internal errors included — is one of those objects.
   The code registry `self/codes.ts` is kept by hand: a new code takes the next
   free number in its band and no number is ever moved or reused, and
   `node scripts/gen-diagnostic-codes.mjs --check` (run by `npm test`) checks
   its format and that every code is unique.
   [`AGENTS.md`](../AGENTS.md) has the table; `docs/wp10-ci.md` has the bands;
   `tests/nish/cli.ts` checks that table from a Nish program that reads the
   answers.

## Where the code is

```
self/               the compiler, in Nish — see .claude/selfhost.md
  compile.ts        CLI: flags, output planning, exit codes
  compilation.ts    one program: load, check, emit, sidecars
  lexer.ts parser.ts nodes.ts validator.ts types.ts diagnostics.ts codes.ts
  checker.ts …      pass 1 signatures, pass 1b imports, pass 2 bodies
  emit*.ts ir.ts    runtime.ts, target.ts, escape.ts, attributes.ts, debug.ts
  interop_*.ts      C header, wasm .d.ts, N-API shim
std/                the standard library, in Nish — testing.ts, text.ts, json.ts,
                    std/README.md
runtime/            runtime.c, runtime_os.c, nish.h, nish.d.ts, runtime_wasm.c,
                    shim.mjs
bin/                the npm command: hands over to the prebuilt native compiler
tests/              run.js + cases/ (goldens), link/, ir/, layout/,
                    differential/, self/ (goldens, bootstrap, the surviving
                    oracles), wordings/, nish-cmp.js (last release vs HEAD),
                    nish/run.ts (the golden runner, in Nish: npm run test:nish),
                    nish/cli.ts (the CLI contract, in Nish: npm run test:cli)
docs/               LANGUAGE, ARCHITECTURE, IR_COOKBOOK, MASTER_PLAN, wp*.md
```

## Commands

```bash
npm ci                      # install (typescript and biome are dev dependencies)
bash scripts/fetch-seed.sh  # the last release into build/seed/ (or set NISH_BOOTSTRAP)
npm run build               # self/, built by the seed, into build/nish
npm run check               # ambient tsc --noEmit over self/, std/, tests/nish
npm test                    # the whole suite; builds its own stage1 from the seed
node tests/run.js <sub>     # only checks whose name contains <sub>
node tests/run.js self      # the WP14 self-hosting section alone
npm run test:update         # write missing .ll goldens
scripts/bootstrap.sh --verify   # IR(stage1) == IR(stage2), stage3 == stage2
npm run test:cli            # the CLI contract, through the harness in Nish
npm run lint                # biome, advisory, never a compile gate
```

`npm test` needs LLVM 18 on `PATH` (`clang`, `llc`, `llvm-as`, `opt`, `ld.lld`,
`wasm-ld`). Without it the toolchain-dependent checks **skip rather than fail**,
so a green run without LLVM proves much less than it looks. The run says so:
the summary is `N passed, M failed, K skipped` and a `DEGRADED:` banner names
the tools it could not find. Read the skip count, not just the failure count.
In a fresh container `.claude/hooks/session-start.sh` installs the toolchain and
fetches the seed so this does not happen quietly.

`npm run check` is `tsc --noEmit` with no emit and no compiler behind it: it
type-checks `self/`, `std/` and `tests/nish/` as TypeScript against
`runtime/nish.d.ts`, the declarations of the language's builtins. That catches
a type error in the compiler's source before the seed is asked to build it, but
it is not Nish's checker — a construct TypeScript accepts and Nish refuses
passes it. What clears a `self/` change is the compiler building itself:
`npm test` builds stage1 with the seed and compiles every golden with it, and
`scripts/bootstrap.sh --verify` takes it to the fixed point.
[`selfhost.md`](./selfhost.md) is the rest of that story.

## Definition of done

`npm run check` and an undegraded `npm test` green, and a new construct ships
with a golden `.ll`, an `llvm-as` pass, a native round trip with expected
stdout, at least one negative test, its `docs/LANGUAGE.md` rule and cookbook
entry, and a `CHANGELOG.md` line. It is implemented once, in `self/`, and under
the **rolling freeze** `self/` may not use it in its own source until the next
release, because the seed that builds `self/` is the last release.

## Where to read next

| Question | Document |
| --- | --- |
| I am working on `self/` | [`selfhost.md`](./selfhost.md) |
| Where did stage0 go, and what replaced its oracles? | `docs/wp19-stage0-retirement.md` |
| How do I add a construct? | `docs/ARCHITECTURE.md` → "How to add a construct" |
| What does the language allow? | `docs/LANGUAGE.md` |
| I am writing a *program*, not the compiler | `docs/AI.md` — the same rules in one pass, examples compiled by `npm test` |
| What IR does X compile to? | `docs/IR_COOKBOOK.md` |
| How do I write the code? | [`typescript.md`](./typescript.md) |
| How do I test it? | [`testing.md`](./testing.md) |
| What is the plan? | `docs/MASTER_PLAN.md`, `docs/wp14-selfhost.md` |
