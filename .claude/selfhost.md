# Self-hosting: working in `src/`

`src/` is the compiler, written in the language it compiles. The plan of record
is [`docs/wp14-selfhost.md`](../docs/wp14-selfhost.md); this file is the map you
need before touching a line of it.

## The claim, and that it holds

```
IR(stage1, src/)  ==  IR(stage2, src/)      byte for byte
```

The seed is the last released `nish`. stage1 is `src/` built by the seed,
stage2 is `src/` built by stage1, stage3 is `src/` built by stage2 and must be
byte-identical to stage2. `npm test` and CI's `bootstrap` job hold all of that
on every run.

`src/` is the only implementation of Nish. Until WP19 R6 a second one in
TypeScript, "stage0" (built by `tsc` into `dist/`; it lived in its own `src/`
while this compiler was in `self/`), seeded the chain
and was the oracle every phase was compared with, and the stronger equality
`IR(stage0, src/) == IR(stage1, src/)` held too. R6 deleted it;
[`docs/wp19-stage0-retirement.md`](../docs/wp19-stage0-retirement.md) is the
record of what that cost and of what replaced each of its oracles.

**The rolling freeze.** `src/` is compiled by the last release, so it may only
*use* in its own source what that release compiles. A construct is implemented
in `src/` and tested in the same change; `src/` may write it in its own
source from the next release on, when the seed has it. CI's `bootstrap` job
builds `src/` with the released seed on every pull request, which is what
fails a change that uses a construct too early.

## Milestones

| | Deliverable | State |
| --- | --- | --- |
| S1 | `src/lexer.ts` tokenises Nish-0 | **done** — `tests/lexer-oracle.js` |
| S2 | `src/parser.ts` builds the tree | **done** — `tests/parser-oracle.js` |
| S3 | the checker: types, scopes, side tables | **done** — proved against stage0 by `checked_oracle.js` until R6, by `tests/self/goldens/` since |
| S4 | the emitter: IR text | **done** — proved against stage0 by `ir_oracle.js` and `interop_oracle.js` until R6, by the `.ll` goldens and `tests/nish-cmp.js` since |
| S5 | `src/` compiles `src/` | **done** — `tests/self/bootstrap.js`: `IR(stage1) == IR(stage2)`, stage3 == stage2 |
| R1–R6 | stage0 retired | **done** — R6 deleted stage0's `src/`, the `typescript` runtime dependency, the six stage0 oracles, `--parity` and the stage1-only register. The gates, the order and the measurements are in [`docs/wp19-stage0-retirement.md`](../docs/wp19-stage0-retirement.md) §3 and §5 |

## Building it for use

`npm test` builds the compiler it tests into `build/nish-test`, and the
surviving oracles build theirs into temporary directories. To get one you can
keep:

```bash
bash scripts/fetch-seed.sh          # the last release, into build/seed/
npm run build                       # build/nish (stage2, speed)
scripts/bootstrap.sh --verify       # the same, plus the two equalities, with cmp
NISH_BOOTSTRAP=<released nish> scripts/bootstrap.sh --verify   # another seed
build/nish hello.ts --link hello    # -o, --link, --profile, its own directories
```

`--verify` asserts `IR(stage1) == IR(stage2)` and `stage3 == stage2`, and
reports `IR(seed) == IR(stage1)` as a note: with a released seed that
comparison asks whether codegen has changed since that release, so a codegen
improvement is expected to move it. What the seeded run enforces is the rolling
freeze, and it enforces it by stage1 building at all
(`docs/wp19-stage0-retirement.md` G3, and the header of `scripts/bootstrap.sh`).

`src/compile.ts` is the whole command line (`docs/wp14-selfhost.md` §7a). It
plans `-o <file.ll>`, `-o <dir>/` and `--link <exe>`, validates
`--profile speed|size|debug|wasi` before compiling anything, makes every
directory in the way of the IR, a sidecar or the binary with `mkdirSync`, and
runs `bash scripts/build.sh` through `spawnSync` for the link, found one level
up from the binary's own path or in the working directory. `-g` goes into the
`.ll` *and* on to that script. `--json`, `--emit-ast`, `--emit-checked`,
`--version`, `--target host` and the interop sidecars (`--emit-header`,
`--emit-dts`, `--emit-napi`, and the loader `--emit-dts` writes beside its
declarations) are all answered there. `--emit-ast` prints the flattened tree
`src/nodes.ts` defines, with byte offsets, through `src/ast-text.ts` — shared
with `src/dump-ast.ts` so the flag and the parser oracle cannot drift — and is
pinned by `tests/cases/dump_ast.stdout`. A broken invariant exits **70** with
the report `src/ice.ts` prints, and `NISH_SIMULATE_ICE` is the hook the suite
drives that path with.

## The rules that are specific to this work

1. **A construct enters the language and `src/` in the same change**, with its
   `reject_*` case and its cookbook entry. Wanting it for the compiler's own
   source is not a reason to skip either, and the compiler's own source may not
   use it until the seed compiles it, one release later.
2. **`src/` is an Nish-0 program**: a function is a `const` bound to an
   arrow, with a concise body where there is one `return`, and a struct is a
   `class` or an `interface`. The `biome.json` plugin reads `src/`, so a new
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

## Nish-0, the subset `src/` is written in

No generics, closures, nested functions or function values; no `type` aliases,
`enum`, `namespace`, `static` members, getters or setters; no `try`/`catch`; no
inheritance and no downcasts. **Arrow functions came off that list in WP22**:
a top-level `const` bound to an arrow is a *declaration*, not a value, and the
prohibition that matters — a function is never a value — is untouched by it.
What the rest forces:

- **One `Node` class** with a `kind: i32` discriminant and the union of the
  fields any node needs (`src/nodes.ts`). No hierarchy, no downcast; the child
  layout per kind is the contract and is written beside each kind there.
- **One `TypeInfo`**: a type is an `i32` interned in a `TypeTable`
  (`src/types.ts`), so type equality is an integer compare.
- **No `Map`**: `StringMap` / `StringSet` over parallel arrays with FNV-1a and
  linear probing (`src/map.ts`), in the layout WP32 chose for the global `Map`
  (`docs/wp32-map.md` §2): a `u32` bucket of eight fingerprint bits above an
  entry index plus one, and each entry's full hash stored beside its key, so a
  probe reads a key only on a fingerprint and hash match and growth never
  hashes a key again. Iteration is insertion order, which is what a
  golden-compared dump needs.
- **No `try`/`catch`**: error-value threading. `ctx.error(node, msg)` reports and
  returns; callers test a status or a `T_ERROR` sentinel. `panic(msg)` is for
  the internal invariants.
- **Side tables are arrays indexed by `Node.id`**, not `WeakMap`s
  (`src/program.ts`). The parser hands out dense ids, so the size is known
  before the checker starts.
- **String building goes through `StringBuilder` + `join`**, never `s = s + t`
  in a loop: that is quadratic in time *and* arena, and measured 180 MB of peak
  RSS for 88 KB of IR.

## The modules

| `src/` | holds |
| --- | --- |
| `strings.ts` `map.ts` `paths.ts` | the standard library the compiler needs and Nish-0 does not have |
| `packages.ts` `nish-modules.ts` `std-modules.ts` `manifest.ts` | module resolution: which package a module is in and the prefix its symbols carry, the `nish:` builtin modules, the `nish/` standard library, and the `nish` condition of a `package.json` (WP21) |
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
| `inline-arrays.ts` | which array fields are stored inside their objects, decided once every body is checked (docs/LANGUAGE.md, "Fixed-length array fields are stored inline") |
| `escape.ts` `attributes.ts` | escape analysis and the whole-program attribute fixpoint |
| `debug.ts` | the DWARF metadata `-g` emits |
| `emit.ts` `emit-util.ts` `emit-ops.ts` `emit-control.ts` `emit-strings.ts` `emit-arrays.ts` `emit-classes.ts` `emit-builtins.ts` `emit-result.ts` | the emitter |
| `compilation.ts` | the whole-program driver |
| `interop-abi.ts` `interop-header.ts` `interop-dts.ts` `interop-wasm.ts` `interop-napi.ts` | the WP8 sidecars, one module per file |
| `dump.ts` `ast-text.ts` | the `--emit-checked` and `--emit-ast` text, printed by both the driver and the dump entries |
| `dump-tokens.ts` `dump-ast.ts` `dump-checked.ts` `compile.ts` | the dump entry points the oracles spawn, and the CLI |
| `run-cache.ts` | `nish run`'s cache: where an entry lives, the key a hit is compared on, and the hash that names it |

Cyclic imports between family modules are fine and already used
(`expressions.ts` ↔ `members.ts`), because the dispatch entry point and its
handlers live on opposite sides of the cycle.

## How `src/` is tested

Every tool below builds its compiler from `src/` with the seed
(`tests/self/seed.js`: `--seed`, then `NISH_BOOTSTRAP`, then `build/nish`, then
the fetched release in `build/seed/`), and all of them are wired into `tests/run.js`, skipped without
clang.

| Tool | Compares |
| --- | --- |
| the golden cases | every `tests/cases/` and `tests/link/` program against its `.ll`, `.out`, `.err` and `.stdout` — the specification of every lowering and every refusal |
| `tests/nish-cmp.js` | the last **released** compiler against the one HEAD builds, byte for byte over the corpus: every module's IR and the four WP8 sidecars. A difference fails unless `DECLARED` names it and `CHANGELOG.md` carries the words — the successor to `ir_oracle.js` and `interop_oracle.js` |
| `tests/self/goldens.js` | stage1 against `tests/self/goldens/`: the `--emit-checked` dump of the corpus and of `src/`, and the stdout of the types, diagnostics and symbols drivers — the successor to the four stage0 oracles that compared those (WP19 G2.4) |
| `tests/lexer-oracle.js` | `src/lexer.ts` against the `typescript` scanner, token for token |
| `tests/parser-oracle.js` | `src/parser.ts` against the `typescript` parser, node for node and span for span |
| `tests/self/support-oracle.js` | `strings.ts` / `map.ts` / `paths.ts` against `node:path`, `JSON.stringify`, `Buffer` and `Map`, and the escapes stage0 used to answer, frozen in `tests/self/goldens/` |
| `tests/self/reject-oracle.js` | every `reject_*` case and every `tests/link/` negative, against its own expected fragments. The comparison is driven over fabricated inputs by a `selfCheck` on every run |
| `tests/diagnostic-coverage.js` | the compiler against `tests/wordings/`, one program per diagnostic code, and against **the registry**: a code in `src/codes.ts` that no program provokes and no line of `tests/wordings/unreachable.txt` explains fails the run (WP19 G2.4, "The wording gap") |
| `tests/self/bootstrap.js` | the stages: `IR(stage1) == IR(stage2)`, and stage3 byte-identical to stage2 |
| `tests/differential/` | every whole program natively against its **frozen** JavaScript rewrite under Node, and `fuzz.js --stage1` over random programs the WP13 generator invents |

The corpus is `tests/cases/`, `examples/`, `src/`, `docs/cookbook/`, `bench/`,
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
the comparison in silence — the WP15 `--wrapping` cases once took a tool from
one skip to seven without failing anything. Run the tools with `--verbose` and read the reasons before believing
a count.

### Running one

```bash
npm run build                          # build/nish, from the seed
node tests/lexer-oracle.js
node tests/parser-oracle.js  --verbose
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
expression and `src/` has no rewriter — so it cannot be rewritten at all, only
checked for freshness (`node tests/differential/goldens.js --fresh`, and wp19
§6 item 6 for what the freeze does not save). A corpus program with no frozen
rewrite is named in a register rather than silently skipped. `src/`'s dump is
stored deduplicated by module — 19.9 MB of live text, 1.0 MB of distinct text
— and the comparison still reads every byte of it.

## Habits that have paid off

- **Write the oracle before the phase.** Four bugs across S1 and S2 were found
  in minutes, all in the same direction: the front end having opinions the
  scanner does not.
- **Lex and parse what is written; refuse in the phase that owns the rule.**
  A construct the language forbids is parsed into a node, and Phase 0 (an
  NL1xxx code) or the checker (an NL2xxx code) refuses it with its rule's
  message and exactly one diagnostic — never the parser, whose only sentence
  is the token it expected. WP33 R1 fixed the shape, and every construct that
  comes off `tests/self/parser-refusals.txt` follows it; the full statement is
  beside the flags in `src/nodes.ts`:
  - it **resembles a node that exists** → that node with a flag: `var` is an
    `N_VAR` with `FLAG_VAR`, `for...in` and `for await` an `N_FOR_OF` with
    `FLAG_FOR_IN` / `FLAG_AWAIT`, a top-level `let` an `N_MODULE_CONST`
    without `FLAG_CONST`, `x?: T` and `static` a field or method with a flag;
  - it **resembles nothing** → a kind of its own with its child layout written
    beside it: `N_TRY`, `N_WITH`, `N_LABELED`;
  - it **differs in what one child is** → the same node with that child, when
    the child's kind is the tell: `for (x of a)` is an `N_FOR_OF` whose head
    is an expression, a top-level statement is the statement itself in the
    `N_SOURCE_FILE`.

  The refusal runs before anything else reads the node, so no later rule has
  to know the shape exists, and `src/ast-text.ts` prints every flag so that
  `--emit-ast` and `tests/parser-oracle.js` compare it. A word the lexer
  treats as an identifier (`var`, `try`, `with`, `in`, `await`) is matched by
  text where it opens the construct, as `of` and `using` are, so the lexer
  and its oracle stay as they are. When a case comes off, it leaves both
  parser-refusal registers and the R6 section of
  `tests/wordings/unreachable.txt` in the same change, with its `.err`
  re-pinned to the rule.
- **A disagreement is triaged before the next phase starts.** Three stage0 bugs
  came out of S3 that way and three more out of S4 — all wrong *attributes*
  rather than wrong instructions, which is the class of bug a golden `.ll` is
  worst at catching — and every one shipped with a case in `tests/`.
- **A skip in an oracle is a to-do list.** S2's "needs ParenthesizedType" skip
  sat there for three milestones and named exactly the grammar S5 turned out
  to need.
