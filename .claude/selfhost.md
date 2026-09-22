# Self-hosting: working in `self/`

`self/` is the compiler, written in the language it compiles. The plan of record
is [`docs/wp14-selfhost.md`](../docs/wp14-selfhost.md); this file is the map you
need before touching a line of it.

## The claim, and that it holds

```
IR(stage1, self/)  ==  IR(stage2, self/)      byte for byte
```

The seed is the last released `nish`. stage1 is `self/` built by the seed,
stage2 is `self/` built by stage1, stage3 is `self/` built by stage2 and must be
byte-identical to stage2. `npm test` and CI's `bootstrap` job hold all of that
on every run.

`self/` is the only implementation of Nish. Until WP19 R6 a second one in
TypeScript, `src/` ("stage0", built by `tsc` into `dist/`), seeded the chain
and was the oracle every phase was compared with, and the stronger equality
`IR(stage0, self/) == IR(stage1, self/)` held too. R6 deleted it;
[`docs/wp19-stage0-retirement.md`](../docs/wp19-stage0-retirement.md) is the
record of what that cost and of what replaced each of its oracles.

**The rolling freeze.** `self/` is compiled by the last release, so it may only
*use* in its own source what that release compiles. A construct is implemented
in `self/` and tested in the same change; `self/` may write it in its own
source from the next release on, when the seed has it. CI's `bootstrap` job
builds `self/` with the released seed on every pull request, which is what
fails a change that uses a construct too early.

## Milestones

| | Deliverable | State |
| --- | --- | --- |
| S1 | `self/lexer.ts` tokenises Nish-0 | **done** — `tests/lexer_oracle.js` |
| S2 | `self/parser.ts` builds the tree | **done** — `tests/parser_oracle.js` |
| S3 | the checker: types, scopes, side tables | **done** — proved against stage0 by `checked_oracle.js` until R6, by `tests/self/goldens/` since |
| S4 | the emitter: IR text | **done** — proved against stage0 by `ir_oracle.js` and `interop_oracle.js` until R6, by the `.ll` goldens and `tests/nish-cmp.js` since |
| S5 | `self/` compiles `self/` | **done** — `tests/self/bootstrap.js`: `IR(stage1) == IR(stage2)`, stage3 == stage2 |
| R1–R6 | stage0 retired | **done** — R6 deleted `src/`, the `typescript` runtime dependency, the six stage0 oracles, `--parity` and the stage1-only register. The gates, the order and the measurements are in [`docs/wp19-stage0-retirement.md`](../docs/wp19-stage0-retirement.md) §3 and §5 |

## Building it for use

`npm test` builds the compiler it tests into `build/nish-test`, and the
surviving oracles build theirs into temporary directories. To get one you can
keep:

```bash
bash scripts/fetch-seed.sh          # the last release, into build/seed/
npm run build                       # build/nish (stage2, speed)
scripts/bootstrap.sh --verify       # the two equalities, with cmp
NISH_BOOTSTRAP=<released nish> scripts/bootstrap.sh --verify   # another seed
build/nish hello.ts --link hello    # -o, --link, --profile, its own directories
```

`--verify` asserts `IR(stage1) == IR(stage2)` and `stage3 == stage2`, and
reports `IR(seed) == IR(stage1)` as a note: with a released seed that
comparison asks whether codegen has changed since that release, so a codegen
improvement is expected to move it. What the seeded run enforces is the rolling
freeze, and it enforces it by stage1 building at all
(`docs/wp19-stage0-retirement.md` G3, and the header of `scripts/bootstrap.sh`).

`self/compile.ts` is the whole command line (`docs/wp14-selfhost.md` §7a). It
plans `-o <file.ll>`, `-o <dir>/` and `--link <exe>`, validates
`--profile speed|size|debug|wasi` before compiling anything, makes every
directory in the way of the IR, a sidecar or the binary with `mkdirSync`, and
runs `bash scripts/build.sh` through `spawnSync` for the link, found one level
up from the binary's own path or in the working directory. `-g` goes into the
`.ll` *and* on to that script. `--json`, `--emit-ast`, `--emit-checked`,
`--version`, `--target host` and the interop sidecars (`--emit-header`,
`--emit-dts`, `--emit-napi`, and the loader `--emit-dts` writes beside its
declarations) are all answered there. `--emit-ast` prints the flattened tree
`self/nodes.ts` defines, with byte offsets, through `self/ast_text.ts` — shared
with `self/dump_ast.ts` so the flag and the parser oracle cannot drift — and is
pinned by `tests/cases/dump_ast.stdout`. A broken invariant exits **70** with
the report `self/ice.ts` prints, and `NISH_SIMULATE_ICE` is the hook the suite
drives that path with.

## The rules that are specific to this work

1. **A construct enters the language and `self/` in the same change**, with its
   `reject_*` case and its cookbook entry. Wanting it for the compiler's own
   source is not a reason to skip either, and the compiler's own source may not
   use it until the seed compiles it, one release later.
2. **`self/` is an Nish program**, and since WP22 stage C it declares a
   function as a `const` bound to an arrow, with a concise body where there is
   one `return`. `interface` for structs and no `type` aliases still hold,
   because an Nish struct is a `class` or an `interface`. `biome.json` does not
   exempt `self/` from the arrow rule — the plugin reads it, so a new
   `function` declaration there is a lint warning rather than a convention
   somebody has to remember.
3. **A golden is regenerated from the compiler and then read.** With no second
   implementation to compare against, a golden that changes is the only place
   a changed lowering shows; `npm run test:update` writes what the compiler
   says, and a diff nobody read is a bug recorded as the specification.
4. **The runtime budget still holds.** Lower inline rather than growing
   `runtime.c`.
5. **Nish-0 does not grow quietly.** Adding a construct to the subset is an
   edit to `docs/wp14-selfhost.md` and a line in `CHANGELOG.md`.

## Nish-0, the subset `self/` is written in

No generics, closures, nested functions or function values; no `type` aliases,
`enum`, `namespace`, `static` members, getters or setters; no `try`/`catch`; no
inheritance and no downcasts. **Arrow functions came off that list in WP22**:
a top-level `const` bound to an arrow is a *declaration*, not a value, and the
prohibition that matters — a function is never a value — is untouched by it.
What the rest forces:

- **One `Node` class** with a `kind: i32` discriminant and the union of the
  fields any node needs (`self/nodes.ts`). No hierarchy, no downcast; the child
  layout per kind is the contract and is written beside each kind there.
- **One `TypeInfo`**: a type is an `i32` interned in a `TypeTable`
  (`self/types.ts`), so type equality is an integer compare.
- **No `Map`**: `StringMap` / `StringSet` over parallel arrays with FNV-1a and
  linear probing (`self/map.ts`). Iteration is insertion order, which is what a
  golden-compared dump needs.
- **No `try`/`catch`**: error-value threading. `ctx.error(node, msg)` reports and
  returns; callers test a status or a `T_ERROR` sentinel. `panic(msg)` is for
  the internal invariants.
- **Side tables are arrays indexed by `Node.id`**, not `WeakMap`s
  (`self/program.ts`). The parser hands out dense ids, so the size is known
  before the checker starts.
- **String building goes through `StringBuilder` + `join`**, never `s = s + t`
  in a loop: that is quadratic in time *and* arena, and measured 180 MB of peak
  RSS for 88 KB of IR.

## The modules

| `self/` | holds |
| --- | --- |
| `strings.ts` `map.ts` `paths.ts` | the standard library the compiler needs and Nish-0 does not have |
| `packages.ts` `nish_modules.ts` `std_modules.ts` `manifest.ts` | module resolution: which package a module is in and the prefix its symbols carry, the `nish:` builtin modules, the `nish/` standard library, and the `nish` condition of a `package.json` (WP21) |
| `branding.ts` | the language name every diagnostic reads — the one source file that spells it |
| `ice.ts` | the exit-70 report a broken invariant prints, which the language's `panic` (exit 1) is not |
| `tokens.ts` `lexer.ts` | the scanner |
| `nodes.ts` `parser.ts` `parents.ts` | the tree, and the parent links it does not carry itself |
| `diagnostics.ts` `codes.ts` | the diagnostic sink and the hand-kept code registry |
| `types.ts` `symbols.ts` | interned types, the scope chain and locals |
| `program.ts` `context.ts` | the side tables, and the checker's context |
| `validator.ts` | Phase 0 |
| `checker.ts` `declarations.ts` `structs.ts` `annotations.ts` `constants.ts` `assignment.ts` | pass 1, pass 1b and the declaration-level rules |
| `generics.ts` `result.ts` | monomorphisation (WP18) and `Result<T, E>` (WP16) |
| `expressions.ts` `statements.ts` `members.ts` `arrays.ts` `builtins.ts` | pass 2, one module per construct family |
| `bounds.ts` | the WP15 §2 bounds-check proof, whose verdicts the emitter reads out of `nodeProvenIndex` |
| `ir.ts` `runtime.ts` `target.ts` `options.ts` | the IR builder, the runtime ABI table, the target triples, the options |
| `tbaa.ts` | the type-based alias metadata on class field accesses (WP9) |
| `escape.ts` `attributes.ts` | escape analysis and the whole-program attribute fixpoint |
| `debug.ts` | the DWARF metadata `-g` emits |
| `emit.ts` `emit_util.ts` `emit_ops.ts` `emit_control.ts` `emit_strings.ts` `emit_arrays.ts` `emit_classes.ts` `emit_builtins.ts` `emit_result.ts` | the emitter |
| `compilation.ts` | the whole-program driver |
| `interop_abi.ts` `interop_header.ts` `interop_dts.ts` `interop_wasm.ts` `interop_napi.ts` | the WP8 sidecars, one module per file |
| `dump.ts` `ast_text.ts` | the `--emit-checked` and `--emit-ast` text, printed by both the driver and the dump entries |
| `dump_tokens.ts` `dump_ast.ts` `dump_checked.ts` `compile.ts` | the dump entry points the oracles spawn, and the CLI |

Cyclic imports between family modules are fine and already used
(`expressions.ts` ↔ `members.ts`), because the dispatch entry point and its
handlers live on opposite sides of the cycle.

## How `self/` is tested

Every tool below builds its compiler from `self/` with the seed
(`tests/self/seed.js`: `--seed`, then `NISH_BOOTSTRAP`, then `build/seed`, then
`build/nish`), and all of them are wired into `tests/run.js`, skipped without
clang.

| Tool | Compares |
| --- | --- |
| the golden cases | every `tests/cases/` and `tests/link/` program against its `.ll`, `.out`, `.err` and `.stdout` — the specification of every lowering and every refusal |
| `tests/nish-cmp.js` | the last **released** compiler against the one HEAD builds, byte for byte over the corpus: every module's IR and the four WP8 sidecars. A difference fails unless `DECLARED` names it and `CHANGELOG.md` carries the words — the successor to `ir_oracle.js` and `interop_oracle.js` |
| `tests/self/goldens.js` | stage1 against `tests/self/goldens/`: the `--emit-checked` dump of the corpus and of `self/`, and the stdout of the types, diagnostics and symbols drivers — the successor to the four stage0 oracles that compared those (WP19 G2.4) |
| `tests/lexer_oracle.js` | `self/lexer.ts` against the `typescript` scanner, token for token |
| `tests/parser_oracle.js` | `self/parser.ts` against the `typescript` parser, node for node and span for span |
| `tests/self/support_oracle.js` | `strings.ts` / `map.ts` / `paths.ts` against `node:path`, `JSON.stringify`, `Buffer` and `Map`, and the escapes stage0 used to answer, frozen in `tests/self/goldens/` |
| `tests/self/reject_oracle.js` | every `reject_*` case and every `tests/link/` negative, against its own expected fragments. The comparison is driven over fabricated inputs by a `selfCheck` on every run |
| `tests/diagnostic_coverage.js` | the compiler against `tests/wordings/`, one program per diagnostic code, and against **the registry**: a code in `self/codes.ts` that no program provokes and no line of `tests/wordings/unreachable.txt` explains fails the run (WP19 G2.4, "The wording gap") |
| `tests/self/bootstrap.js` | the stages: `IR(stage1) == IR(stage2)`, and stage3 byte-identical to stage2 |
| `tests/differential/` | every whole program natively against its **frozen** JavaScript rewrite under Node, and `fuzz.js --stage1` over random programs the WP13 generator invents |

The corpus is `tests/cases/`, `examples/`, `self/`, `docs/cookbook/`, `bench/`,
`tests/parser/`, `tests/differential/corpus/` and `tests/link/`, plus the
`main.ts` of any directory inside one of those — the multi-module shape, which
is `examples/multi/` and the three `modules_*` / `const_modules` programs of
the differential corpus. `tests/self/corpus.js` enumerates it and answers what
flags each program is compiled with. **When this list changes, re-derive the
numbers that quote it rather than editing the list alone**: until 2026-09-22 it
claimed `tests/differential/corpus/` and the directory programs for weeks
before any tool read them (wp19 §A9).

The fuzzer's `--stage1` mode has no corpus at all: it generates its programs
from a seed, so the only thing that reproduces a failure is the seed it prints
(`--stage1 --seed <s> --count 1`) and the program it saves under
`build/test/differential/`.

A skip in a tool's summary is a fact about what was not compared, not a file
that is allowed to disagree, and a skip prints only under `--verbose`: a new
corpus file whose `.args` names a flag a tool does not know is dropped from
the comparison in silence. That happened once already, when the WP15
`--wrapping` cases took the IR oracle from one skip to seven without failing
anything. Run the tools with `--verbose` and read the reasons before believing
a count.

### Running one

```bash
npm run build                          # build/nish, from the seed
node tests/lexer_oracle.js
node tests/parser_oracle.js  --verbose
node tests/self/goldens.js checked --verbose
node tests/nish-cmp.js                 # the seed against HEAD; NISH_BOOTSTRAP names the seed
node tests/differential/fuzz.js --stage1 --count 300
node tests/run.js self                 # all of them, as the suite runs them
```

Each program is independent of every other, so the corpus-wide tools compare
`--jobs` at a time, one job per core and capped at eight (`tests/pool.js`).
Results are walked in corpus order whatever order they finish in, so the
summary and the named failures are the same at any width: **`--jobs 1` is the
sequential runner, and is the first thing to reach for when a parallel run says
something surprising.**

### The goldens

```bash
node tests/self/goldens.js                  # verify all of them, ~13 s
node tests/self/goldens.js checked --verbose
npm run test:update                         # regenerate, with the .ll goldens
node tests/self/goldens.js --update         # regenerate these alone
```

They were written by stage1 while stage0 still agreed with it byte for byte,
which is what made them the agreed behaviour rather than one compiler's
opinion. Regenerating one now records what the compiler says today, so read the
diff before committing it. **One store is frozen rather than regenerated**:
`tests/differential/goldens/rewrites.txt`, the WP13 oracle's JavaScript, whose
reference was stage0's *checker* — the rewrite needs the static type of every
expression and `self/` has no rewriter — so it cannot be rewritten at all, only
checked for freshness (`node tests/differential/goldens.js --fresh`, and wp19
§6 item 6 for what the freeze does not save). A corpus program with no frozen
rewrite is named in a register rather than silently skipped. `self/`'s dump is
stored deduplicated by module — 19.9 MB of live text, 1.0 MB of distinct text
— and the comparison still reads every byte of it.

## Habits that have paid off

- **Write the oracle before the phase.** Four bugs across S1 and S2 were found
  in minutes, all in the same direction: the front end having opinions the
  scanner does not.
- **Lex and parse what is written; refuse in the phase that owns the rule.**
  `??` is tokenised and then rejected by the parser with a message that names
  the idiom to use instead.
- **A disagreement is triaged before the next phase starts.** Three stage0 bugs
  came out of S3 that way and three more out of S4 — all wrong *attributes*
  rather than wrong instructions, which is the class of bug a golden `.ll` is
  worst at catching — and every one shipped with a case in `tests/`.
- **A skip in an oracle is a to-do list.** S2's "needs ParenthesizedType" skip
  sat there for three milestones and named exactly the grammar S5 turned out
  to need.
