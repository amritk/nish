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
| S1 | `self/lexer.ts` tokenises AmritScript-0 | **done** — `tests/lexer_oracle.js`, 482/482 files |
| S2 | `self/parser.ts` builds the tree | **done** — `tests/parser_oracle.js`, 447/447 files |
| S3 | the checker: types, scopes, side tables | **done** — `tests/self/checked_oracle.js` and `reject_oracle.js` |
| S4 | the emitter: IR text | **done** — `tests/self/ir_oracle.js`, 206/206 files byte for byte |
| S5 | `self/` compiles `self/` | **done** — `tests/self/bootstrap.js`: `IR(stage1) == IR(stage2)`, stage3 == stage2 |

## Building it for use

The oracles build compilers into temporary directories and delete them. To get
one you can keep:

```bash
npm run bootstrap                            # build/amritc (stage2, speed)
scripts/bootstrap.sh --verify                # the three equalities, with cmp
scripts/amritc.sh hello.ts --link hello   # its command line: -o, --link, --profile
```

`scripts/amritc.sh` is the wrapper D4 promised: it makes the output
directory and runs `scripts/build.sh`, which is the half of the driver stage1
does not have. It takes `-g` and passes it on to both halves; it refuses the
dumps and the interop sidecars **by name** — they are stage0's, not missing —
and mirrors stage0's file layout exactly, so either compiler can be dropped
into a build script. See `docs/wp14-selfhost.md` §7.

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
| `dump_tokens.ts` `dump_ast.ts` `dump_checked.ts` `compile.ts` | the `--emit-*` dumps in `src/dump.ts`, and the CLI |

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
| `tests/self/checked_oracle.js` | the `--emit-checked` dump, over every positive program in the corpus |
| `tests/self/reject_oracle.js` | every `reject_*` case, against its own `.err` fragments |
| `tests/self/ir_oracle.js` | the emitted IR, byte for byte, over every whole program in the corpus |
| `tests/self/bootstrap.js` | the stages: `IR(stage0) == IR(stage1) == IR(stage2)`, and stage3 byte-identical to stage2 |

The corpus is `tests/cases/`, `examples/`, `self/`, `docs/cookbook/`, `bench/`,
`tests/differential/corpus/` and `tests/parser/`. A skip in an oracle summary is
a fact about how far the port has got, not a file that is allowed to disagree —
which is why rejections are counted and named apart from the other skips.

### Running one

```bash
npm run build                          # the oracles spawn dist/index.js
node tests/lexer_oracle.js
node tests/parser_oracle.js  --verbose
node tests/self/checked_oracle.js tests/cases/cls_fields.ts
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
