# Self-hosting: working in `self/`

`self/` is the compiler written in the language it compiles. The plan of record
is [`docs/wp14-selfhost.md`](../docs/wp14-selfhost.md); this file is the map you
need before touching a line of it.

## The claim being built

```
IR(stage1, self/)  ==  IR(stage2, self/)      byte for byte
```

stage1 is `self/` built by stage0, stage2 is `self/` built by stage1, stage3 is
`self/` built by stage2 and must be byte-identical to stage2. A second, weaker
equality — `IR(stage0, p) == IR(stage1, p)` over `tests/cases/` — is the S4
oracle, enabled per file as the port lands.

## Milestones

| | Deliverable | State |
| --- | --- | --- |
| S1 | `self/lexer.ts` tokenises StaticTS-0 | **done** — `tests/lexer_oracle.js`, 482/482 files |
| S2 | `self/parser.ts` builds the tree | **done** — `tests/parser_oracle.js`, 447/447 files |
| S3 | the checker: types, scopes, side tables | **done** — `tests/self/checked_oracle.js` and `reject_oracle.js` |
| S4 | the emitter: IR text | in progress |
| S5 | `self/` compiles `self/` | not started |

## The rules that are specific to this work

1. **A construct enters the language before it enters `self/`.** Wanting it for
   the port is not a reason to skip its `reject_*` case or its cookbook entry.
2. **`self/` is a StaticTS program.** `function` declarations, `interface` for
   structs, no arrow functions, no `type` aliases — the opposite of the house
   rules for `src/`, because the language has neither. `biome.json` exempts it.
3. **stage0 is the oracle.** Every phase is tested by comparing it with the
   corresponding stage0 output over the corpus, never by a hand-written golden.
4. **The runtime budget still holds.** Lower inline rather than growing
   `runtime.c`.
5. **StaticTS-0 does not grow quietly.** Adding a construct to the subset is an
   edit to `docs/wp14-selfhost.md` and a line in `CHANGELOG.md`.

## StaticTS-0, the subset `self/` is written in

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
| `dump_tokens.ts` `dump_ast.ts` `dump_checked.ts` | the `--emit-*` dumps in `src/dump.ts` |

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
  came out of S3 that way and all three shipped with cases in `tests/`.
