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
on every run; in CI the `test` job delegates its copy to the `bootstrap` row
for its platform rather than proving it twice (`.claude/testing.md`).

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
    without `FLAG_CONST`, `x?: T` and `static` a field or method with a flag,
    `a?.b` an `N_MEMBER` (or `N_INDEX`, `N_CALL`) with `FLAG_OPTIONAL`,
    `async` and `function*` a function, method or arrow with `FLAG_ASYNC` /
    `FLAG_GENERATOR`, a default type argument the type parameter with
    `FLAG_DEFAULT`, a default, optional or rest parameter the parameter with
    `FLAG_DEFAULT`, `FLAG_OPTIONAL` or `FLAG_REST`, `get x()` / `set x(v)`
    a method with `FLAG_ACCESSOR`, `abstract` the class or member with
    `FLAG_ABSTRACT`, `declare class`, `declare interface` and `declare enum`
    theirs with `FLAG_FOREIGN`, a parameter property the parameter with
    `FLAG_PROPERTY`, a computed name `[k]` — in an object literal, a class or
    an interface — the property, field or method with `FLAG_COMPUTED` and the
    key's expression where its name would be (an `N_PROPERTY`'s second child,
    as a string key is), `export default function f`, `class C` and
    `interface I` theirs with `FLAG_DEFAULT`, and `import type` (or `type`
    in front of one name), `import defer`, attributes after the specifier, a
    specifier that is not a string literal and `export import` the
    `N_IMPORT` (or `N_IMPORT_SPEC`) with `FLAG_TYPE_ONLY`, `FLAG_DEFER`,
    `FLAG_ATTRIBUTES`, `FLAG_COMPUTED` and `FLAG_EXPORTED`. An operator is
    the operator node whose text it is: `==`,
    `in`, `**` and the comma an `N_BINARY`, `typeof`, `void`, `delete`,
    `await` and `yield` an `N_UNARY`;
  - it **resembles nothing** → a kind of its own with its child layout written
    beside it: `N_TRY`, `N_WITH`, `N_LABELED`, `N_REGEX`, `N_AS` (with
    `FLAG_ANGLE` / `FLAG_SATISFIES` for `<T>x` and `satisfies`), `N_SPREAD`,
    `N_DECORATOR` (around what it decorates), `N_NAMESPACE` (`namespace`,
    `module` and `declare global`, its body passed over unread) and
    `N_TYPE_OPERATOR` (`keyof T`), `N_BINDING_PATTERN` (a destructuring
    pattern where a name is bound, passed over unread),
    `N_INDEX_SIGNATURE` (`[k: string]: T`, in a class or an interface),
    `N_EXPORT_ASSIGNMENT` (`export default <value>`, `export =`),
    `N_EXPORT_DECLARATION` (`export { a }`, `export * from`),
    `N_IMPORT_EQUALS` (`import x = require("./m")`) and
    `N_NAMESPACE_EXPORT` (`export as namespace X`);
  - it **differs in what one child is** → the same node with that child, when
    the child's kind is the tell: `for (x of a)` is an `N_FOR_OF` whose head
    is an expression, a top-level statement is the statement itself in the
    `N_SOURCE_FILE`, a hole is an `N_EMPTY` element of an `N_ARRAY`, and
    `new a.B()` an `N_NEW` whose callee is the member access, `import.meta`
    an `N_MEMBER` whose receiver is the IDENT `import`, as `import(...)` is
    an `N_CALL` whose callee is, type
    parameters on an alias a third child of the `N_TYPE_ALIAS`, there only
    when written, a missing name, return type or body an EMPTY child of the
    `N_FUNCTION` or `N_METHOD`, a method signature an `N_METHOD` among an
    interface's fields, a top-level `let` bound to an arrow the module
    constant whose initialiser is the `N_ARROW`, the names after the
    first in `const f = (): i32 => 1, g = 2` a sixth child of the
    `N_FUNCTION`, an anonymous class (`export default class { }` with
    `FLAG_DEFAULT`, or a class expression, an `N_CLASS` where an operand
    stands) an EMPTY name, a method or constructor without a body an EMPTY
    body, a constructor's return type a third child of the `N_CONSTRUCTOR`,
    a member named `"a b"` or `0` the `N_STRING` or `N_NUMBER` where its
    name would be, `static { }` the `N_BLOCK` among a class's members, an
    interface's call signature an `N_METHOD` with an EMPTY name (a construct
    signature with `FLAG_CONSTRUCT`), `interface I extends A` a fourth child
    of the `N_INTERFACE`, a key written as a string or a number a second
    child of the `N_PROPERTY`, a method in an object literal the
    `N_METHOD` that is the property's value, object spread `{ ...a }` the
    `N_SPREAD` an array's `...a` is, among the `N_OBJECT`'s properties, a
    namespace import an
    `N_IMPORT` whose bindings child is the IDENT after `* as`, a side-effect
    import one whose bindings child is EMPTY, a default import a second
    child, a module export name written as a string the `N_STRING` where
    the specifier's IDENT would be, and a function or an import declared
    where a statement stands the `N_FUNCTION`, `N_IMPORT` or
    `N_IMPORT_EQUALS` it would be at the top level.

  The refusal runs before anything else reads the node, so no later rule has
  to know the shape exists. An NL2xxx rule that needs no type is a sweep over
  the module in pass 1, never a rule in the body check: a template's body is
  checked only when something instantiates it, so a rule stated there lets an
  uninstantiated one compile (`tests/cases/reject_for_await_template`,
  `reject_type_keyof_template`). The
  sweep (`refuseUnsupportedForms`) runs on each declaration before it is
  collected, so a declaration that holds a refused form reports that alone,
  and it reads a declaration's type parameters first, constraints included,
  where the source has them, though the tree keeps them last; resolving a
  constraint stays quiet about a `keyof` the sweep refused
  (`tests/cases/reject_type_keyof_constraint`). A rule about a node's shape
  is asked where its form is written — a missing return type after the
  parameters, a default after the parameter's type, a declarator's pattern
  before its initialiser — so that the first form in the source is the one
  reported (`tests/cases/reject_fn_sweep_together`), and a method's missing
  return type is the sweep's rather than the collector's, because a generic
  class's members are collected only once instantiated
  (`reject_method_return_template`).
  `src/ast-text.ts` prints every flag so that `--emit-ast` and
  `tests/parser-oracle.js` compare it. A word the lexer treats as an
  identifier (`var`, `try`, `with`, `in`, `await`, `typeof`, `as`, …) is
  matched by text where it opens the construct, as `of` and `using` are, so
  the lexer and its oracle stay as they are — and only where the word could
  not be a name. **Every program the last release compiles must still
  compile, to the same bytes**, and a variable called `typeof` is one: a
  prefix word is an operator only before an operand on its line
  (`Parser.operandAhead`), an infix one only after an operand, a declaration
  word only where TypeScript reads it as one — `async` before `function`, an
  arrow's parameters or a member's name on its line, `namespace` and `module`
  before a name or a string on theirs, `keyof` before a type on its line,
  `abstract`, `declare` and the accessibility words before what they modify
  on theirs, `static` before `{` on any, and `type` and `defer` after
  `import` and in an import's braces exactly where TypeScript's
  `parseImportDeclarationOrImportEqualsDeclaration` and
  `parseImportOrExportSpecifier` read the modifier (`asyncArrowAhead`,
  `namespaceAhead`, `keyofAhead`, `declaredTypeAhead`,
  `parameterModifierAhead`, `typeModifierAhead`, `deferModifierAhead`,
  `Parser.parseSpecifier`) — and `tests/parser/names*.ts` pin the name
  readings. Where an import binds a new name, a word TypeScript reserves and
  the lexer reads as an identifier (`with`, `var`, `in`, …) is the syntax
  error it is in TypeScript (`bindingNameAhead`). Check a new word against the
  seed in every position a name can stand, line breaks included, before it
  goes in. A regex is the one token the lexer cannot decide alone: the parser
  asks it again where an operand is due (`Lexer.scanRegex`). When a case comes off, it leaves both
  parser-refusal registers (and its code's line in
  `tests/wordings/unreachable.txt`, if it has one) in the same change, with
  its `.err` re-pinned to the rule.
- **A parse path stops at its first failed `expect`.** `expect` reports and
  returns `false`; a caller that ignores the `false` and parses on is a
  cascade, the second and third diagnostics describing the first one's
  wreckage. A malformed form costs no more diagnostics than it did before the
  path existed, and usually one. Check a new path by truncating the form at
  every token, followed by a real declaration, against the last release
  (`reject_import_malformed`, `reject_import_equals_malformed`; #337 found two
  such cascades in review).
- **A disagreement is triaged before the next phase starts.** Three stage0 bugs
  came out of S3 that way and three more out of S4 — all wrong *attributes*
  rather than wrong instructions, which is the class of bug a golden `.ll` is
  worst at catching — and every one shipped with a case in `tests/`.
- **A skip in an oracle is a to-do list.** S2's "needs ParenthesizedType" skip
  sat there for three milestones and named exactly the grammar S5 turned out
  to need.
