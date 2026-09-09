# Self-hosting: working in `self/`

`self/` is the compiler written in the language it compiles. The plan of record
is [`docs/wp14-selfhost.md`](../docs/wp14-selfhost.md); this file is the map you
need before touching a line of it.

## The claim, and that it holds

```
IR(stage1, self/)  ==  IR(stage2, self/)      byte for byte
```

stage1 is `self/` built by stage0, stage2 is `self/` built by stage1, stage3 is
`self/` built by stage2 and must be byte-identical to stage2. All of that holds
today over the modules of `self/`, and so does the stronger
`IR(stage0, self/) == IR(stage1, self/)`: the two implementations are the same
compiler, not two compilers that agree about the tests.

`self/` is therefore **frozen against stage0 rather than ahead of it**: a
construct still enters the language (and `src/`) before it enters `self/`, and
`npm test` fails the moment the two disagree about one byte of one module.

## Milestones

| | Deliverable | State |
| --- | --- | --- |
| S1 | `self/lexer.ts` tokenises AmritScript-0 | **done** — `tests/lexer_oracle.js`, 612/612 files |
| S2 | `self/parser.ts` builds the tree | **done** — `tests/parser_oracle.js`, 574/574 files |
| S3 | the checker: types, scopes, side tables | **done** — `tests/self/checked_oracle.js`, 314/314 whole programs; `reject_oracle.js`, 222/222 cases |
| S4 | the emitter: IR text | **done** — `tests/self/ir_oracle.js`, 324/324 programs byte for byte, and `interop_oracle.js`, 60 sidecars |
| S5 | `self/` compiles `self/` | **done** — `tests/self/bootstrap.js`: `IR(stage1) == IR(stage2)`, stage3 == stage2 |
| R1 | parity: no program and no flag is stage0's | **in progress** — G1's check is `tests/self/parity.js`, in two halves: the flag sets each `--help` names, and the corpus under every flag variation. `getenv` and `--emit-ast` landed, the performance warnings and `--no-warn-performance` are stage1's, `--out-dir` is gone, the oracles' stale skips are closed. `--emit-checked` prints the attribute pass's facts now, so `checked_oracle.js` filters nothing, four of §A2's five differences are fixed — the fifth was misrecorded and is really §A3's recovery class — and §A3's five classes are closed too: four in code and one by declaration. Recovery is the one that mattered, and closing it turned up four more contextual-type divergences of the same family, because a compiler that reports every consequence of a mistake buries the ones that are its own |
| R2–R6 | stage0 retired rather than frozen | **not started** — the gates are in [`docs/wp19-stage0-retirement.md`](../docs/wp19-stage0-retirement.md) |

**stage0 is frozen, not retired, and that is a decision with an expiry.** Until
the six gates of `docs/wp19-stage0-retirement.md` §3 close, every rule below
holds as written: stage0 is the oracle, `self/` is frozen against it, and a
construct enters the language before it enters `self/`. Retirement moves the
freeze's reference point from stage0 to the last released `amritc`; it does not
lift it. Do not delete anything stage0 owns without reading that document —
six oracles and the `IR(stage0) == IR(stage1)` equality go with it.

## Building it for use

The oracles build compilers into temporary directories and delete them. To get
one you can keep:

```bash
npm run bootstrap                   # build/amritc (stage2, speed)
scripts/bootstrap.sh --verify       # the three equalities, with cmp
build/amritc hello.ts --link hello  # -o, --link, --profile, its own directories
```

There is no wrapper any more: `scripts/amritc.sh` is deleted and
`self/compile.ts` drives the whole thing (§3a D4, reversed in
`docs/wp14-selfhost.md` §7a). It plans `-o <file.ll>`, `-o <dir>/` and
`--link <exe>` by stage0's rules, validates `--profile speed|size|debug|wasi`
before compiling anything, makes every directory in the way of the IR, a
sidecar or the binary with `mkdirSync`, and runs `bash scripts/build.sh`
through `spawnSync` for the link — the same script `src/index.ts` spawns, found
one level up from the binary's own path or in the working directory. `-g` goes
into the `.ll` *and* on to that script. `--json`, `--emit-checked`, `--version`
and the interop sidecars (`--emit-header`, `--emit-dts`, `--emit-napi`, and the
loader `--emit-dts` writes beside its declarations) it answers itself. It answers
`--emit-ast` too since WP19 R1, and mirrors stage0's file layout exactly, so
either compiler can be dropped into a build script. `--target host` is stage1's
as well (§7a): `process.platform` and `process.arch` are builtins, and
`self/target.ts` composes the triple the way `src/codegen/target.ts` does. **No
flag is stage0's by name any more** — what differs is what one of them *prints*:
`--emit-ast` dumps each compiler's own tree, stage0's in the `typescript`
package's node names and 1-based line:column spans, stage1's in the flattened
vocabulary of `self/nodes.ts` with byte offsets, so there is a golden per
compiler (`tests/cases/dump_ast.stdout`, `tests/self/dump_ast.golden`) and no
oracle between them. The printer is `self/ast_text.ts`, shared with
`self/dump_ast.ts` so the flag and the parser oracle cannot drift. A broken invariant exits **70** with stage0's report, less the stack and
the input names a compiler with no exceptions cannot reach (`self/ice.ts`).

`--emit-ast` is the one flag whose *output* differs by design rather than by
backlog. Both compilers answer it; stage0's dump prints the `typescript`
package's node names and line:column spans, and stage1's prints the flattened
tree `self/nodes.ts` defines with byte offsets. The parser oracle translates
TypeScript into stage1's vocabulary; going the other way would put someone
else's SyntaxKind naming inside the self-hosted compiler, so stage1 prints its
own tree and is held to a golden rather than to stage0
(`tests/self/dump_ast.golden`, checked in the WP14 block of `tests/run.js`).

## The rules that are specific to this work

1. **A construct enters the language before it enters `self/`.** Wanting it for
   the port is not a reason to skip its `reject_*` case or its cookbook entry.
2. **`self/` is an AmritScript program.** `function` declarations, `interface` for
   structs, no arrow functions, no `type` aliases — the opposite of the house
   rules for `src/`, because the language has neither. `biome.json` exempts it.
3. **stage0 is the oracle.** Every phase is tested by comparing it with the
   corresponding stage0 output over the corpus, never by a hand-written golden.
4. **The runtime budget still holds.** Lower inline rather than growing
   `runtime.c`.
5. **AmritScript-0 does not grow quietly.** Adding a construct to the subset is an
   edit to `docs/wp14-selfhost.md` and a line in `CHANGELOG.md`.

## AmritScript-0, the subset `self/` is written in

No generics, arrow functions, closures, nested functions or function values; no
`type` aliases, `enum`, `namespace`, `static` members, getters or setters; no
`try`/`catch`; no inheritance and no downcasts. What that forces:

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

## The modules, and what each replaces

| `self/` | replaces in `src/` |
| --- | --- |
| `strings.ts` `map.ts` `paths.ts` | the standard library `src/` gets from Node |
| `branding.ts` | `src/branding.ts`: the language name every diagnostic reads |
| `ice.ts` | `reportInternalError` in `src/index.ts`: the exit-70 report a broken invariant prints, which the language's `panic` (exit 1) is not |
| `tokens.ts` `lexer.ts` | the `typescript` scanner |
| `nodes.ts` `parser.ts` | the `typescript` parser |
| `diagnostics.ts` | `src/diagnostics.ts` |
| `types.ts` | `src/types.ts` |
| `symbols.ts` | `src/checker/scope.ts` + `LocalVar` |
| `program.ts` | `src/checker/program.ts` |
| `context.ts` | `src/checker/context.ts` |
| `validator.ts` | `src/validator.ts` (Phase 0) |
| `checker.ts` `declarations.ts` `structs.ts` `annotations.ts` `constants.ts` `assignment.ts` | `src/checker/index.ts` and friends |
| `expressions.ts` `statements.ts` `members.ts` `arrays.ts` `builtins.ts` | `src/checker/<family>.ts` |
| `ir.ts` `runtime.ts` `target.ts` `options.ts` | `src/codegen/ir.ts`, `runtime.ts`, `target.ts`, `CompilerOptions` |
| `parents.ts` | `node.parent`, which this tree does not have |
| `escape.ts` `attributes.ts` | `src/codegen/escape.ts` and `attributes.ts` |
| `debug.ts` | `src/codegen/debug.ts`: the DWARF metadata `-g` emits |
| `emit.ts` `emit_util.ts` `emit_ops.ts` `emit_control.ts` `emit_strings.ts` `emit_arrays.ts` `emit_classes.ts` `emit_builtins.ts` | `src/codegen/emitter.ts` and `emit/*.ts` |
| `compilation.ts` | `src/compilation.ts`: the whole-program driver |
| `interop_abi.ts` `interop_header.ts` `interop_dts.ts` `interop_wasm.ts` `interop_napi.ts` | `src/interop/*.ts`: the WP8 sidecars, one module per file so the two stay diffable |
| `dump.ts` | `src/dump.ts`'s `--emit-checked` text, printed by both the driver and the dump entry |
| `ast_text.ts` | `src/dump.ts`'s `--emit-ast` text, printed by both the driver and the dump entry — the arrangement `dump.ts` has for `--emit-checked` |
| `dump_tokens.ts` `dump_ast.ts` `dump_checked.ts` `compile.ts` | the dump entry points the oracles spawn, and the CLI |

Cyclic imports between family modules are fine and already used
(`expressions.ts` ↔ `members.ts`), because the dispatch entry point and its
handlers live on opposite sides of the cycle.

## How `self/` is tested

Every oracle links a stage1 binary with stage0 (`--link`), runs it over a
corpus, and diffs against what stage0 says about the same input. They are all
wired into the WP14 section of `tests/run.js` and skipped without clang.

| Oracle | Compares |
| --- | --- |
| `tests/lexer_oracle.js` | `self/lexer.ts` against the `typescript` scanner, token for token |
| `tests/parser_oracle.js` | `self/parser.ts` against the `typescript` parser, node for node and span for span |
| `tests/self/support_oracle.js` | `strings.ts` / `map.ts` / `paths.ts` against `node:path`, `JSON.stringify`, `Buffer`, `Map` and stage0's own escapes |
| `tests/self/types_oracle.js` | `self/types.ts` against `src/types.ts` |
| `tests/self/diagnostics_oracle.js` | `self/diagnostics.ts` against `src/diagnostics.ts` |
| `tests/self/symbols_oracle.js` | the scope chain and the narrowing rules |
| `tests/self/checked_oracle.js` | the `--emit-checked` dump of every positive program in the corpus, whole program by whole program — every line of it, the attribute pass's `facts:` / `escaping:` / `calls:` / `pointer` / `stackSites=` included since WP19 R1 |
| `tests/self/reject_oracle.js` | every `reject_*` case and every `tests/link/` negative, against its own expected fragments |
| `tests/self/ir_oracle.js` | the emitted IR, byte for byte, over every whole program in the corpus |
| `tests/self/interop_oracle.js` | the WP8 sidecars — `.h`, `.d.ts`, its `.mjs` loader, `.napi.c` — byte for byte over the interop corpus (`--all` for the whole one) |
| `tests/self/parity.js` | everything the command line produces (WP19 G1), in two halves: the flag set each compiler's `--help` names, diffed — the only thing here that asks what flags a compiler *has* — and then the corpus through both compilers under each of the fourteen flag variations the suite uses, comparing exit status, stdout, stderr and every file written. A difference is a failure unless `DECLARED` names it with a reason |
| `tests/self/bootstrap.js` | the stages: `IR(stage0) == IR(stage1) == IR(stage2)`, and stage3 byte-identical to stage2 |
| `tests/differential/fuzz.js --stage1` | the emitted IR, byte for byte, over random programs the WP13 generator invents — the same comparison as the IR oracle, on a corpus that is not checked in |

The corpus is `tests/cases/`, `examples/`, `self/`, `docs/cookbook/`, `bench/`,
`tests/differential/corpus/`, `tests/parser/` and `tests/link/`;
`tests/self/corpus.js` enumerates it and answers what flags each program is
compiled with, so that a program needing `--number-mode f64` is not refused by
stage0 and then counted as though the *port* could not reach it. The fuzzer's
`--stage1` mode has no corpus at all: it generates its programs from a seed, so
the only thing that reproduces a failure is the seed it prints
(`--stage1 --seed <s> --count 1`) and the program it saves under
`build/test/differential/`.

A skip in an oracle summary is a fact about how far the port has got, not a
file that is allowed to disagree — which is why every other outcome is counted
and named apart from it: a stage1 rejection, a parser refusal whose wording
differs by design, a program the reject oracle owns. Three skips are left, one
per oracle and two files between them, and none of them is about `self/`:
`tests/parser/precedence.ts` is a parser fixture no checker accepts, which
`checked_oracle.js` and `ir_oracle.js` both pass over, and `tests/link/no_main`
is refused by `--link`, which is stage0's, so `reject_oracle.js` passes over
that. The three cases that ask for a dump flag are counted apart from the
skips, as dumps: they write no IR on either side. `checked_oracle.js` compares
`--emit-checked` over the whole corpus; `--emit-ast` has no oracle because each
compiler dumps its own tree, and is pinned by a golden per compiler instead.

**That count is a thing to re-derive rather than to trust, and it drifted once
already.** A skip prints only under `--verbose`, so a *new* corpus file whose
`.args` names a flag an oracle does not know is dropped from the comparison in
silence: the WP15 `--wrapping` cases arrived that way and took the IR oracle
from one skip to seven without failing anything. Both flag sets are stage1's
now, `checked_oracle.js` passes the two flags the checker reads, and
`self/dump_checked.ts` refuses a flag it does not know instead of taking it for
the file name — which is what had been dropping `--wrapping` there. Run the
oracles with `--verbose` and read the reasons before believing the three.

### Running one

```bash
npm run build                          # the oracles spawn dist/index.js
node tests/lexer_oracle.js
node tests/parser_oracle.js  --verbose
node tests/self/checked_oracle.js tests/cases/cls_fields.ts
node tests/differential/fuzz.js --stage1 --count 300
node tests/run.js self                 # all of them, as the suite runs them
```

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
