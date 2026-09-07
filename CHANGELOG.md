# Changelog

All notable changes to `statictsc` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/). The release procedure (bump,
changelog, tag, workflow) is in [docs/wp12-release.md](docs/wp12-release.md).

## [Unreleased]

### Added

- **Phase 1: basic math.** `function`, `number` (`i32` by default, `f64` with
  `--number-mode f64`), `boolean`, arithmetic, comparisons, locals, calls, and
  exact LLVM IR output (`add(a, b)` compiles to the documented target IR).
  `--plain` drops all performance annotations.
- **Performance pass.** Zero-GC arena runtime (`runtime/runtime.c`),
  Rust-parity LLVM function/parameter attributes (`noundef`, `nounwind`,
  `willreturn`, `readnone`, ...), alignment hints, and the `scripts/build.sh`
  pipeline with `debug` / `speed` / `size` profiles (LTO, section GC, strip).
  `scripts/size-report.sh` prints before/after binary sizes.
- **Phase 0 validator** (`src/validator.ts`). A single syntax-only pass that
  rejects every construct StaticTS can never compile (`any`, `eval`, `with`,
  dynamic property access, ...) in about 2 ms per 1,000 lines, before the
  checker runs. Biome lint/format configuration, with a rule set that mirrors
  the validator (`noVar`, `noParameterAssign`, `useExplicitLengthCheck`, ...)
  and covers the example, cookbook and benchmark programs, plus the house-style
  rules (`type` over `interface`, arrow functions over `function` declarations)
  reported as warnings while the compiler's own source is migrated.
- **Control flow.** `if` / `else`, `while`, `do ... while`, `for`, `break` /
  `continue`, `throw`, the ternary, short-circuit `&&` / `||`, compound
  assignment and `++` / `--`, with termination analysis feeding the
  `willreturn` attribute.
- **Strings.** Arena-allocated immutable `string` (header + UTF-8 bytes),
  literals, `+` concatenation, `===` / `!==`, `.length`, template literals,
  and `console.log`.
- **Modules, entry point, linkage.** `export function` / named relative
  `import`, whole-program compilation with program-wide attribute facts,
  import cycles, `export function main(): number | void` as the process entry
  (its return value is the exit code), `--link <exe>`, `-o <dir>/` for one
  `.ll` per module, and `--strict-exports` for `internal` linkage.
- **Runtime and intrinsics.** `Math.*` as LLVM intrinsics, the `i64` type with
  explicit numeric conversions, `process.exit`, synchronous file I/O, and
  JavaScript-accurate number formatting in the runtime.
- **Command line, string parsing, WASI.** `process.argv: string[]` (built
  once by the `@main` wrapper with `sts_argv_init`; `argv[0]` is the program
  path; read-only; a compile error in a program without `main`),
  `parseInt(s): i32`, `parseFloat(s): f64` and `Number(x): f64` (JavaScript
  semantics for the decimal forms via one runtime call `sts_parse_number`;
  `parseInt` has no NaN and saturates like `toI32`), and a `wasi` build
  profile (`--link app.wasm --profile wasi`) that links the runtime against
  wasi-libc so whole programs run under any WASI host, including Node's
  (`examples/wasi-host.mjs`). Runtime `.text` at `-Oz` is 4,093 bytes.
- **Interop.** `--emit-header` (C header), `--emit-dts` (TypeScript
  declarations for the wasm exports), `--emit-napi` (N-API shim) plus the
  `napi` and `wasm` build profiles; an FFI benchmark.
- **Typed arrays across the boundary.** `Int32Array`, `Float64Array` and
  `BigInt64Array` are accepted as type annotations and as `new Int32Array(n)`;
  they are the same type as `i32[]` / `f64[]` / `i64[]` (one layout). Exported
  functions taking or returning them cross to Node: the N-API shim borrows a
  JS typed array zero-copy (`napi_get_typedarray_info` under a stack
  `sts_array` header) and returns a fresh typed array, and also bridges
  `string` and `i64` (bigint) arguments and results, releasing the arena per
  call; `--emit-dts` now also writes `<file>.mjs`, a loader that copies typed
  arrays into wasm memory through the new `sts_alloc_array` runtime entry and
  copies results (and written-through arguments) back. `runtime/runtime_wasm.c`
  is a freestanding arena + arrays runtime for the wasm profile (which now
  passes `-mbulk-memory`). `--emit-header` spells read-only array parameters
  `const sts_array *` and written ones `sts_array *`. `examples/arrays.ts`,
  `bench/ffi.mjs` gains the batched `Float64Array` rows.
- **Self-hosting, milestone S3: the body pass and Phase 0**
  (`docs/wp14-selfhost.md` §4). `self/expressions.ts`, `statements.ts`,
  `members.ts`, `arrays.ts`, `builtins.ts` and `validator.ts` are stage0's
  pass 2 and its forbidden-syntax sweep in StaticTS. Two shape decisions
  carry their reasons: the dispatch is **one central `switch`** (D2 of §3a) —
  a table of function values would need function pointers, which StaticTS does
  not have, and a `switch` on a node kind lowers to a jump table — and the
  **contextual type is threaded down** rather than walked up, because the tree
  has no parent pointers; the one place that shows is `console.log` and the
  other `void` builtins, where "must be a statement" is answered by the
  statement checker recording the expression it is about to check.
  `self/` is now **9,235 lines** of StaticTS.
  The proof is both halves of what a checker does. On what it *accepts*,
  `tests/self/checked_oracle.js` compares the `--emit-checked` dump over the
  whole corpus: **207 of 207 files agree over 2,079 lines**, and those lines
  now include the per-body locals and callees, so what is compared is every
  variable's type, every call's resolved callee, every struct's field offsets
  and every folded constant. On what it *refuses*,
  `tests/self/reject_oracle.js` runs every `reject_*` case through stage1 and
  requires the same `.err` fragments the suite already requires of stage0:
  **154 of 154 agree**, with 11 cases named in `tests/self/reject_backlog.txt`
  — `process.argv` being read-only, definite assignment in a constructor,
  `super(...)` placement, and one narrowing rule — so the remaining work is
  counted in the suite output rather than hidden in a skip, and a backlog
  entry that starts agreeing fails until it is removed.
- **A numeric literal in a ternary arm takes the conditional's context.**
  `const x: f64 = c ? 1.5 : 2.5` was rejected — the annotation reached a
  literal written directly but not one behind a `?:`, because the context walk
  had no clause for a conditional. Both arms are the value the context asked
  for, so they inherit it; the condition is a boolean and inherits nothing
  (`tests/cases/f64_ternary_literal`, `reject_ternary_literal_float`). Found
  writing the self-hosted checker, where an `i32`/`f64` limit is chosen with a
  ternary.
- **Self-hosting, milestone S3: the signature pass** (`docs/wp14-selfhost.md`
  §4). `self/checker.ts` and the five modules around it — `program.ts` (the
  side tables), `context.ts`, `annotations.ts`, `declarations.ts`,
  `structs.ts`, `constants.ts` — are stage0's pass 1 in StaticTS: imports and
  class names first so any annotation resolves, then members, layouts and
  function signatures, then `implements`. **206 of 206 corpus files agree with
  stage0 over 1,255 signature lines**, compared through the `--emit-checked`
  dump both compilers write (`tests/self/checked_oracle.js`), so what is
  checked is not "it accepted the file" but every struct's size and alignment,
  every field's index and byte offset, every symbol, every folded constant and
  the order they come out in. The lines later phases fill in — the attribute
  facts, the per-body locals and callees — are filtered rather than left out of
  the format, so they start being compared the moment those phases land.
  Three shape changes carry their reasons: side tables are arrays indexed by a
  dense `Node.id` the parser hands out rather than `WeakMap`s (StaticTS has no
  `WeakMap`, and an index beats hashing a pointer); an annotation's names come
  from a `typeNames` set narrower than the layout registry, which is what keeps
  a reachable layout from becoming a spellable type; and constant folding needs
  no `bigint`, because StaticTS `i64` arithmetic already wraps where stage0 has
  to wrap by hand. The parser now reports into the shared `Diagnostic` of
  `self/diagnostics.ts` rather than a class of its own, so a syntax error and a
  checker error land in one report — and print `file:line:col: syntax error:`
  with an excerpt, exactly as stage0 does.
- **Self-hosting, milestone S3 begun: the type model and the diagnostics**
  (`docs/wp14-selfhost.md` §4). `self/types.ts` is `src/types.ts` with one
  change of representation: a type is an **interned `i32`**, so "are these the
  same type?" — the checker's hottest question — is one integer compare
  instead of a recursive `sameType`, a type fits in the `i32` a `StringMap`
  stores, and `T[]` costs one entry rather than one per mention. It carries a
  thirteenth kind stage0 has no counterpart for: `T_ERROR`, D1's sentinel,
  assignable in both directions so that one bad expression does not produce a
  diagnostic at every site it reaches. `self/diagnostics.ts` is the same
  summary line, source excerpt and `--json` object, over a `SourceFile` that
  indexes its line starts once (a scan per diagnostic is quadratic in a file
  with many errors) and a sink that orders by file-first-mentioned and then
  position with a **stable** bottom-up merge sort — the last outstanding item
  of wave C, and stable because two errors at one position have to keep the
  order the phases produced them in for a multi-error golden to be
  reproducible. Both are checked against stage0's own implementation:
  `tests/self/types_oracle.js` diffs the LLVM type, the alignment, the
  diagnostic spelling and the whole assignability matrix over every type
  either side can build (119 lines), and `tests/self/diagnostics_oracle.js`
  diffs every byte of the messages, the line/column index over *every* offset
  in the fixture, the report order, the `...and N more errors` cut and the
  JSON (570 lines). `self/symbols.ts` is the scope chain and the narrowing
  rules, keyed by identity as `src/checker/scope.ts` is — this is the part of
  the checker a program can observe going wrong, since a narrowing kept one
  statement too long compiles a load through a pointer the checker promised
  was not null, so both implementations are driven through one script
  (shadowing, a narrowing that holds through the chain, an inner one that
  wins, an assignment that drops both) and every answer compared.
- **An imported class or function brings the layouts its signature mentions.** `import
  { Registry }` where `Registry.all(): Entry[]` gives a module `Entry` values
  it can call methods on and read fields of; until now the checker crashed
  with an internal error (`structOf: no struct named \`Entry\``) because
  `Entry` was in no registry there, and the emitter would have had only
  `%struct.Entry = type opaque` to compute a field offset from. The layouts
  now travel with the import, transitively, and their symbols are `declare`d
  the way an imported class's are. Only the layout travels: an annotation
  still needs the name in scope, so `const e: Entry` in that module is
  unchanged (`tests/link/reachable_struct`,
  `tests/link/reachable_struct_annotation`). A base reached through `extends`
  and a `this` parameter are deliberately excluded — both are used through a
  pointer the checker already holds, and including them would turn the
  `%struct.Base = type opaque` of `tests/link/extends_import` into a
  definition. The closure is a whole-program pass after every module has bound
  its imports, not a step inside binding: a struct that reaches a module
  through a chain of two — `main` imports `mid`'s class, whose method returns
  `leaf`'s — would otherwise be found or not depending on the order the
  modules happened to be bound in (`tests/link/reachable_struct_chain`). Found
  by writing the self-hosted compiler's own `diagnostics`, `annotations` and
  `statements` modules — a sink that hands back a `Diagnostic[]`, a context
  that reads a `StringSet` field, and an imported `caseValue(): CaseValue`
  (`tests/link/reachable_struct_return`).
- **Self-hosting, wave C: the support library** (`docs/wp14-selfhost.md` §3).
  `self/strings.ts`, `self/map.ts` and `self/paths.ts` are the 598 lines of
  StaticTS the checker and the emitter are written over, and no language
  change came with them. `StringBuilder` is a `string[]` and one `join`,
  because `s = s + t` in a loop is quadratic in both time and memory — 88 KB
  of IR built that way costs 180 MB of peak RSS. `StringMap` / `StringSet`
  replace the ~200 `Map` / `Set` sites in `src/` with open addressing over a
  *dense entry list*: FNV-1a and linear probing into a bucket table of entry
  indices, so iteration is insertion order (a hash order would make a
  golden-compared diagnostic dump depend on the table size) and `""` needs no
  sentinel. `self/paths.ts` is `node:path`'s POSIX behaviour, which §3a D3
  calls a hazard rather than tedium: module identity is the resolved path, so
  a `..` normalised differently from Node's loads one file twice and stops
  cycles terminating. `tests/self/support_oracle.js` is the test, and every
  line of it has an implementation that already exists on the other side —
  stage0's own `escapeBytes` and `f64Constant` for the two IR escapes,
  `node:path`'s POSIX side for the path functions, and `JSON.stringify`,
  `Buffer.compare` and `Map` for the rest, over the shared case table both
  sides read. **863 lines agree.** One divergence is deliberate and written
  down: `basenameWithout` is not `path.basename(p, ext)`, whose corners are
  artifacts (`basename("///", ".ts")` is `"///"`, and `basename(".ts", ".ts")`
  is `""` while `basename("x/.ts", ".ts")` is `".ts"`).
- **Self-hosting, milestone S2: the parser** (`docs/wp14-selfhost.md` §4).
  `self/parser.ts` is recursive descent over the S1 lexer, building the
  one-`Node`-class tree of `self/nodes.ts` — a `kind` discriminant, a fixed
  child layout per kind, `N_LIST` for the variable-length groups and `N_EMPTY`
  for the absent ones, so nothing ever downcasts. It has no exceptions,
  because StaticTS `throw` discards its value: a failed parse is an `N_ERROR`
  node plus a diagnostic on the parser, and the declaration after it still
  parses. `tests/parser_oracle.js` walks the `typescript` tree, prints it in
  `self/dump_ast.ts`'s format and diffs: **447 files, 53,673 nodes, no
  disagreement**, span for span, with the 43 skipped files all `reject_*`
  cases whose forbidden constructs StaticTS-0 has no grammar for yet. Four
  front-end bugs came out of the two oracles, all the same shape — a lexer or
  parser having an opinion the scanner does not: `==` and `?.` refused rather
  than read, `super` missing from the model although the language has
  inheritance, and `from` and `of` made hard keywords when they are contextual
  (`tests/cases/cls_nested.ts` has a field called `from`). `self/` is 2,817
  lines of StaticTS and parses 84 KB of its own source in 7 ms, against
  14.5 ms for the `typescript` parser warm in a Node process.
- **Self-hosting, milestone S1: the lexer** (`docs/wp14-selfhost.md` §4).
  `self/lexer.ts` tokenises StaticTS-0 and is written in it — 1,222 lines with
  `self/tokens.ts` and `self/dump_tokens.ts`, using nothing the language did
  not already have. It is new code rather than a port: `src/` has no lexer,
  because the `typescript` package is the scanner there. Byte offsets
  throughout, since `s.length` and `charCodeAt` are byte-oriented; template
  literals are lexed without the parser's help, with one brace counter per
  open substitution telling a substitution's `}` from a block's.
  `tests/lexer_oracle.js` is the test: it runs the `typescript` scanner over
  `tests/cases/`, `examples/`, `self/`, `docs/cookbook/`, the differential
  corpus and the new `tests/lexer/` fixtures, prints the token stream in the
  same format and diffs it — **482 files, 50,968 tokens, no disagreement**,
  with the scanner's UTF-16 offsets mapped through the source's byte prefix.
  The lexer has no opinions: `==`, `?.`, `??`, `**`, `...`, `@` and `#name`
  are all tokenised as written, and the parser is where StaticTS refuses them.
- **`switch` / `case` / `default`** (`docs/wp14-selfhost.md` A1). An integer
  discriminant and constant labels — a literal, its negation, or a module
  constant — lower to one LLVM `switch`, so the backend builds a jump table
  (`llc -O2` emits `jmpq *.LJTI0_0(,%rax,8)` for twelve dense labels). Only an
  integer switches: a string one would have been a chain of `sts_str_eq` calls
  wearing a switch's clothes. There is no implicit fallthrough — a clause with
  statements ends in `break`, `return`, `continue` or `throw` unless it is the
  last, while an *empty* clause falls through, which is how `case 1: case 2:`
  gives several labels one body. A clause may not declare a variable without a
  block of its own, because TypeScript's one shared clause scope would leave it
  visible and unassigned below. `break` inside a `switch` leaves the switch and
  `continue` reaches past it to the enclosing loop
  (`tests/cases/cf_switch`, `cf_switch_break`, six `reject_switch_*` cases,
  `tests/differential/corpus/cf_switch.ts`).
- **The string byte methods** (`docs/wp14-selfhost.md` A2): `charCodeAt`,
  `substring`, `indexOf`, `startsWith`, `endsWith` and `String.fromCharCode`.
  Every offset is a UTF-8 byte offset, like `s.length`, because a lexer walks
  bytes and a code-point index would cost a decode per access. They lower
  inline rather than to runtime calls: `charCodeAt` is the array bounds check
  and a `load i8`, `substring` is JavaScript's clamp — `llvm.smin`/`llvm.smax`
  into `[0, len]`, then the pair in order, which `opt -O2` folds to one
  `max(0, min(n, len))` — plus one `sts_str_new`, and `indexOf` is a scan in
  the emitted code. The one new runtime symbol is `sts_str_at(s, at, sub)`,
  which `startsWith`, `endsWith` and the `indexOf` scan share; `runtime.c` is
  3,842 bytes of `.text` at `-Oz`, inside the 4,096-byte budget.
  `charCodeAt` bounds-checks and exits 1 where JavaScript answers `NaN`, which
  `number` cannot hold, and the escape and attribute analyses learned that a
  string method reads its receiver and that `substring` allocates
  (`tests/cases/str_bytes`, `str_search`, four `reject_str_*` cases,
  `tests/differential/corpus/str_methods.ts`).
- **Array `pop`, `indexOf` and `join`** (`docs/wp14-selfhost.md` A4). `pop`
  hands back the last element and stores the shortened length; an empty array
  panics through the same `sts_panic_index` an index does, because there is no
  `undefined` to return. `indexOf` scans with the `===` of the element type —
  content for strings, identity for classes and arrays, `fcmp oeq` for floats,
  so a `NaN` element is never found. `join` is `string[]` only and is the fast
  shape the port needs: one pass summing the lengths, one `sts_alloc_struct`,
  one `llvm.memcpy` per part and per separator, with the separator before the
  first part skipped by selecting a length of zero rather than by branching.
  Building the same text with `+` in a loop copies everything again per part
  and never reclaims — 180 MB of peak arena for 88 KB of output. All three
  lower inline, so `runtime.c` gains nothing (a runtime `join` would have cost
  252 bytes of a 254-byte margin). A numeric literal argument to `push` or
  `indexOf` now takes the element type, so `wide.push(3)` on an `i64[]` is an
  `i64` three (`tests/cases/arr_join`, `arr_pop_index`, five `reject_*` cases,
  `tests/differential/corpus/arr_methods.ts`).
- **`console.error`, the newline-free writes, `readFileSyncOrNull` and
  `panic`** (`docs/wp14-selfhost.md` B2, B3 and D1). A compiler's diagnostics
  go to stderr and two of its dumps write without a trailing newline, neither
  of which `console.log` can do: `console.error(x)` takes what `console.log`
  takes and writes it to stderr, and `write(s)` / `writeError(s)` write a
  string as it is, on fd 1 or 2. All three share one runtime entry point,
  `sts_write(s, fd, newline)`, which `sts_print` now delegates to, so no
  existing golden moved. `readFileSyncOrNull(path): string | null` is the same
  read as `readFileSync` but answers `null` where that one exits, which is
  what lets a program turn a missing import into its own diagnostic and carry
  on loading the rest; it subsumes an `existsSync` and has no time-of-check
  race. `panic(message)` writes the message to stderr and exits 1, the same
  ending an out-of-range index has, and terminates control flow like
  `process.exit`, so an internal invariant keeps the message that `throw`
  discards. `runtime.c` is 3,950 bytes of `.text` at `-Oz`, inside the
  4,096-byte budget (`tests/cases/io_streams`, three `reject_*` cases,
  `tests/differential/corpus/io_streams.ts`, `io_panic.ts`).
- **Bitwise operators.** `& | ^` (`and` / `or` / `xor`), `~` (`xor x, -1`),
  `<< >> >>>` (`shl` / `ashr` / `lshr`), and the compound forms
  `&= |= ^= <<= >>= >>>=` on a mutable local. Two `i32` or two `i64` of the
  same type; `f64` is refused because StaticTS never converts implicitly, and
  `boolean` is refused with the operator that does the job named in the
  message (`&&`, `||`, `!==`, `!`). Shift counts are masked to the operand
  width, as in JavaScript, so `x << 33` is `x << 1` instead of the poison LLVM
  produces for an over-wide shift; a constant count is masked at compile time
  and emits no `and`. `>>>` on `i32` yields the signed reading of the shifted
  bits (`-1 >>> 0` is `-1`, not JavaScript's `4294967295`), the same choice the
  language already makes when integer arithmetic wraps. None of these has a
  panic path, so a function whose arithmetic is all bitwise keeps `readnone`
  and `willreturn`.
- **Arrays.** `T[]` / `Array<T>`, literals, `new Array<T>(n)`, indexing with
  bounds checks (panic on out-of-range), `.length`, `push`, `for ... of`, and
  `--unchecked-indexing` for benchmarks.
- **Classes and interfaces.** `class` / `interface` as `%struct.<Name>` with
  clang-identical layout (verified against C `_Static_assert`s at test time),
  constructors, methods (`this` as the first parameter), field reads and
  writes, object literals, structural `implements`, `export class` across
  modules, and struct-pointer attributes (`nonnull`, `dereferenceable`,
  `readonly` / `nocapture` by a whole-program escape fixpoint).
- **Single class inheritance (WP2b).** `class D extends B` lays `D` out as
  `B`'s fields followed by its own, so a `D` converts to `B` (or any
  ancestor) with one `bitcast` wherever a `B` is expected (arguments,
  variables, returns, fields, `B[]` elements, `B | null`); `super(...)` as
  the first statement of a derived constructor (implicit when no ancestor
  constructor takes parameters), inherited constructors, `super.m()`,
  overriding with an identical signature, `implements` on the flattened
  layout, and multi-level chains. Dispatch is static: a call uses the method
  of the receiver's declared type, never a vtable (`docs/LANGUAGE.md`,
  Classes). Downcasts, `instanceof`, extending an interface or an imported
  class, cyclic inheritance, redeclared fields, and signature-changing
  overrides are rejected. The generated C header now declares every class
  and interface as a `struct` with the flattened fields and every method
  and constructor as `Class_method(struct Class *, ...)`.
- **Memory strategy (WP6).** Escape-analysed stack allocation: a `new`,
  object literal, array literal or `new Array<T>(<literal>)` that provably
  does not outlive its function becomes an entry-block `alloca`
  (`--no-stack-alloc` disables it). Automatic arena scopes: a function whose
  arena temporaries all die with it brackets its body with the new
  `sts_arena_mark` / `sts_arena_release` runtime calls, so hot loops keep the
  arena flat. `Arena.reset` / `mark` / `release` / `used` builtins, and
  `T | null` for class, interface, array and string types with checker-
  enforced narrowing (`if (p !== null)`, early return, `while`, `&&`, `?:`).
  See [docs/wp6-memory.md](docs/wp6-memory.md).

- **Escape analysis fix.** A `new C(...)` whose constructor captures `this`
  (`registry.last = this`) is no longer placed on the stack; `new C(...)`
  where an interface or base type is expected now allocates and constructs
  `C` (it previously allocated the target type and skipped the constructor).
- **Differential testing.** `npm run test:diff` compiles every whole program
  in `tests/cases` and a 50-program corpus, runs the same TypeScript under
  Node through `runtime/shim.mjs` with i32-wrapping rewrites, and compares
  stdout and exit codes byte for byte; a seeded expression fuzzer runs 10
  programs in `npm test` and 200 on demand. Known semantic gaps are listed in
  `tests/differential/known-failures.txt`.
- **Examples.** `examples/nbody.ts` (classes, arrays, `Math` in f64 mode)
  prints the reference energies and is covered by `npm run smoke`.
- **Checked integer division.** `/` and `%` on `i32` / `i64` panic with
  "attempt to divide by zero" / "attempt to divide with overflow" (exit 1)
  instead of executing an `sdiv` / `srem` whose result is poison, matching
  Rust. `Math.pow` follows ECMAScript for `pow(x, NaN)` and `pow(±1, ±Infinity)`.
  Ordering comparisons are numeric only; `?.` and `??` are rejected by the
  validator; the literal `-2147483648` is accepted.
- **Optimisation flags and benchmarks.** `--target <triple>|host` emits
  `target datalayout` / `target triple`; `--nsw` makes signed overflow
  undefined for extra optimisation; array parameters carry
  `dereferenceable(24)`; `scripts/build.sh --pgo-generate` / `--pgo-use`.
  `bench/` holds fib, nbody, spectral-norm, sieve, string building and a
  struct-heavy loop in StaticTS, C and Rust with a checksum-validated runner
  (`node bench/run.mjs`) that writes `docs/BENCHMARKS.md`.
- **CI and diagnostics.** GitHub Actions matrix (Ubuntu + macOS, LLVM 18) with
  a size table in the job summary; every error is
  `<file>:<line>:<col>: error: <message>` followed by a caret excerpt.
- **Multi-error reporting, `--json`, debug dumps, `-g`.** A failed compile
  reports every error (Phase 0: every forbidden construct; pass 1: per
  declaration; pass 2: per statement, the function marked poisoned) in
  source order, 20 at most before `...and N more errors`; a lone error prints
  unchanged. `--json` prints one
  `{file, line, column, endLine, endColumn, severity, message}` object per
  line on stdout for editors. `--emit-ast` dumps the syntax tree,
  `--emit-checked` the checker's tables and attribute facts. `-g` emits DWARF
  (`DICompileUnit`, `DISubprogram` per function, `DILocation` on every
  instruction, `DILocalVariable`s for parameters and locals, struct and array
  composite types); `--link -g` and `scripts/build.sh -g` keep it through
  every profile. Without `-g` the IR is byte-identical.
- **Release engineering.** `--version`; documented exit codes (0 ok, 1 compile
  error, 2 usage, 3 toolchain, 70 internal compiler error, stack trace with
  `STATICTSC_DEBUG=1`); a clear per-platform install hint when `--link` cannot
  find `clang`; `scripts/build.sh` and `runtime/runtime.c` resolved from the
  package root so a global `npm install -g statictsc` works from any
  directory; npm `files` whitelist, `prepublishOnly`, `LICENSE` (MIT);
  `npm run smoke` (`scripts/smoke.sh`) builds and runs every example with a
  `main`; `.github/workflows/release.yml` attaches the npm tarball to a GitHub
  release on `v*` tags; `docs/INSTALL.md`.
- **Unsigned integers `u8`, `u16`, `u32`, `u64`.** LLVM has no unsigned types,
  so they lower to `i8`/`i16`/`i32`/`i64` and the signedness lives in the
  operations: `udiv`/`urem`, `icmp ult/ule/ugt/uge`, `lshr` for `>>`, `zext`
  for a widening conversion, `uitofp`/`llvm.fptoui.sat` across `f64`, and
  `llvm.umin`/`umax` for `Math.min`/`Math.max`. Representing an unsigned value
  therefore costs nothing, and the unsigned divisor check is *one* compare
  against zero rather than the signed check's three plus an `and` and an `or`,
  because unsigned division has no `MIN / -1` case. Overflow wraps as it does
  for the signed widths (`--nsw` emits `nuw` here, not `nsw`); a conversion
  between two integers of the same width and different signedness emits no
  instruction at all; `toU8`/`toU16`/`toU32`/`toU64` join the conversion
  builtins; a literal in an unsigned context must be non-negative and fit the
  width; mixing signednesses or widths is a type error, as `i32` and `i64`
  already were. `console.log` and template holes print unsigned values
  unsigned through the new `sts_str_from_u64` (the narrow widths `zext` into
  it, so one runtime symbol serves all four). `--emit-header` spells them
  `uint8_t` … `uint64_t` and `--emit-dts` `number` / `bigint`.
- **32-bit floats: `f32`.** LLVM's `float`, with the same instructions `f64`
  already uses one width down (`fadd`/`fsub`/`fmul`/`fdiv`/`frem`, `fcmp o*`,
  `fneg`); float division stays unchecked. A struct of `f32` is half the
  footprint of one of `f64` and gives twice the SIMD lane count, which serves
  the speed and the size goal at once. `toF32` joins the conversion builtins:
  `fptrunc` down from an `f64`, `fpext` up, `sitofp`/`uitofp` in from an
  integer by the source's signedness, and the saturating
  `llvm.fpto{s,u}i.sat.<T>.f32` out to one. There is no implicit widening, so
  `f32 + f64` is the same same-type error as `u32 + i32`. A non-integer
  literal takes `f32` from context and is emitted as the hex of the double it
  equals, rounded so that double is exactly a float — `0.1` is
  `float 0x3FB99999A0000000`, not the `f64` spelling `0x3FB999999999999A`.
  `console.log` and template holes widen with `fpext` and reuse
  `sts_str_from_f64`, adding no runtime code, so an `f32` prints
  JavaScript's digits for the float's value (`0.10000000149011612` for `0.1`).
  `Math.abs`/`min`/`max` work through the `.f32` intrinsics; the f64-only
  `Math` functions stay f64-only. `Float32Array` is one more typed-array alias
  for `f32[]`. `--emit-header` spells it `float` and `--emit-dts` `number`.
- **Bitwise operators on every integer width.** `& | ^ ~ << >> >>>` and their
  compound forms already worked on `i32` and `i64`; they now take any integer
  type. `>>` is the one operator whose lowering depends on signedness: `ashr`
  on a signed type, `lshr` on an unsigned one, which makes `>>` and `>>>`
  the same instruction there (`tests/cases/u_shift_logical`). `i32 >>> n`
  keeps its documented behaviour of yielding the raw bits read as signed
  (`-1 >>> 0` is `-1`, not JavaScript's `4294967295`) — with `u32` the other
  answer is now available: `toU32(-1)` is `4294967295`. The shift-count mask
  follows the operand's own width, so `u8` masks to 7 and `u16` to 15 rather
  than to JavaScript's 31 (`tests/cases/bit_shift_narrow`).
- **Documentation.** `docs/LANGUAGE.md` (the normative reference, every rule
  cited to a test case), `docs/IR_COOKBOOK.md` (generated from
  `docs/cookbook/*.ts` by `docs/cookbook/regen.sh`), `docs/ARCHITECTURE.md`,
  `docs/FAQ.md`, the `docs/README.md` index, `docs/check-links.mjs`, and a
  README restructured into a short tour.
- **Module constants (WP14).** `const NAME: T = <constant expression>` at the
  top level, with `export` and `import` (`tests/link/const_export`). A module
  constant is a name for a value, not a global: the checker folds the
  initialiser and every use site carries the value, so no symbol, no
  initialiser and no relocation is emitted, and a module still has no
  top-level code. The initialiser is an ordinary StaticTS expression
  restricted to literals and other constants, so a constant can compute
  exactly what a runtime expression can — integer arithmetic wraps at the
  declared width, `1 / 0` is refused at compile time rather than at run time,
  and a value that does not fit its annotation is an error. Folding is by
  need, so a constant may name one declared later or in another module, and a
  cycle is diagnosed. `--emit-checked` prints each constant's folded value.
  The first item of the self-hosting gap list in
  [docs/wp14-selfhost.md](docs/wp14-selfhost.md).
- **Self-hosting plan.** [docs/wp14-selfhost.md](docs/wp14-selfhost.md): what
  "the compiler compiles itself" means here (a `self/` compiler written in
  StaticTS, and the `IR(stage1) == IR(stage2)` fixed point that proves it),
  the StaticTS-0 subset it is written in, and the ordered list of what the
  language is still missing.

### Fixed

- **Dispatch tables no longer see `Object.prototype`.** The validator, checker
  and emitter are each a table keyed by identifier, read with a key taken from
  the program being compiled. A plain object literal inherits from
  `Object.prototype`, so a program declaring `function valueOf`, `class
  toString`, `const hasOwnProperty` or calling `new constructor()` found a
  native function sitting in the table and used it as a handler — reporting
  `error: function valueOf() { [native code] }`. All ten such lookups now go
  through `src/lookup.ts`, whose one line of `Object.hasOwn` is the fix
  (`tests/cases/decl_prototype_names`).
- **Contextual typing of non-integer literals** reaches two more positions: an
  array-literal element and a field assignment, so `const xs: f64[] = [0.5]`
  and `this.ratio = 0.25` compile in the default i32 number mode rather than
  being rejected as non-integer literals (`tests/cases/conv_f64_context`). An
  empty array literal likewise takes its element type from a field target, so
  `this.children = []` works in a constructor (`docs/wp14-selfhost.md` B4).
- **Fuzzer validity.** `tests/differential/fuzz.js` parses each generated
  program and re-rolls the seed while it has a syntax error, so a run no
  longer reports a compile error for a program TypeScript itself rejects
  (the `a < b > (c)` type-argument ambiguity; roughly one seed in 200).

### Changed

- **Runtime budget (WP9b).** `runtime/runtime.c` is back inside the
  `docs/MASTER_PLAN.md` budget without any observable change: `text` at `-Oz`
  4,195 -> 3,714 bytes (`.text` 2,637 -> 2,245, `.eh_frame` 1,344 -> 1,240),
  source 11,432 -> 9,392 bytes; the plain-message panics share one cold
  `sts_die` and the two formatted ones (index, file path) are a single
  `dprintf` each instead of hand-written digit loops, the JS `Number#toString`
  formatter indexes the `%.*e` buffer directly and emits all four layouts from
  one digit loop, and the three chunk-freeing loops share `sts_free_until`.
  Adding `sts_str_from_u64` for the unsigned widths took it to 3,765 bytes,
  still inside the 4,096-byte budget: it shares the signed formatter's digit
  loop through a static `str_from_digits(value, negative)` helper.
  `scripts/size-report.sh` now prints a `runtime` row (the budget number) above
  the profile rows. Prototypes, symbols and `tests/runtime_test.c` are
  unchanged; see the "Runtime budget" section of
  [docs/wp9-optimisation.md](docs/wp9-optimisation.md).

[Unreleased]: https://github.com/amritk/compiler/compare/v0.1.0...HEAD
