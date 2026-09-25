# Nish compiler architecture

How `nish` is put together: the pipeline, the side-table design that
keeps the checker and the emitter apart, the extension points for adding a
construct, the ABI contracts and the tests that guard them, the rules that
make every emitted LLVM attribute sound, and the build profiles. Read
[LANGUAGE.md](LANGUAGE.md) for what the language is and
[IR_COOKBOOK.md](IR_COOKBOOK.md) for what it compiles to.

## The pipeline

The compiler is `self/`, written in Nish (the Nish-0 subset of
[wp14-selfhost.md](wp14-selfhost.md)), and it is the only implementation.
It is built by the previous release, the *seed* (see
[Bootstrapping](#bootstrapping) below), and nothing in it runs on Node.

```
nish a.ts b.ts [-o out/] [--link exe] [--emit-header a.h ...]      self/compile.ts
   │
   ▼
Compilation                                                            self/compilation.ts
   ├─ load (per module, transitively through imports; each file once)
   │    ├─ Phase A  parse        tokens, then one Node tree              self/lexer.ts, self/parser.ts
   │    ├─ Phase 0  validate     forbidden-syntax sweep, hard fail       self/validator.ts
   │    └─ pass 1   signatures   functions, classes, interfaces, imports self/checker.ts
   ├─ check
   │    ├─ pass 1b  bind imports to the exporters' signatures
   │    ├─ reject external-symbol clashes across modules
   │    └─ pass 2   bodies       one switch per syntactic category       self/statements.ts, self/expressions.ts
   ├─ emit
   │    ├─ Phase C0 attributes   program-wide purity/escape/loop fixpoint self/attributes.ts
   │    └─ Phase C1 IR text      one module per source file             self/emit.ts
   └─ interop sidecars           --emit-header / --emit-dts / --emit-napi self/interop_*.ts
   │
   ▼
.ll files ──▶ scripts/build.sh + runtime/*.c ──▶ native binary / .wasm / .node
```

| Stage | File(s) | Responsibility |
| --- | --- | --- |
| CLI | `self/compile.ts`, `self/options.ts`, `self/ice.ts` | Flag parsing, output planning (`-o file.ll`, `-o dir/`, `--link exe` intermediates, every directory in the way made with `mkdirSync`), running `bash scripts/build.sh` through `spawnSync` for the link, exit codes (0 ok, 1 compile error, 2 usage, 3 toolchain, 70 internal). `ice.ts` prints the internal-error report a broken invariant exits 70 with. |
| Compilation | `self/compilation.ts` | Owns every `ModuleUnit` of one program: loads roots and imports (keyed by resolved path, so cycles terminate), runs the checker passes in the right order, rejects symbol clashes, runs the attribute analysis over all modules, emits one `.ll` per module, and computes output stems. It does not decide where output goes; `compile.ts` writes it. |
| Parser | `self/tokens.ts`, `self/lexer.ts`, `self/nodes.ts`, `self/parser.ts`, `self/parents.ts` | The compiler's own scanner and parser. The tree is one `Node` class with a `kind: i32` discriminant and dense ids; the child layout per kind is written beside each kind in `nodes.ts`. A syntax error is a diagnostic like any other. |
| Validator | `self/validator.ts` | One pre-order walk, dispatched by a `switch` on the node kind; decides everything from syntax alone (no types, no scopes). What is here is forbidden by design; what the checker refuses with `Unsupported ...` is merely not implemented yet. Defence in depth: it sees nodes the checker never visits. |
| Types | `self/types.ts`, `self/annotations.ts` | A type is an `i32` interned in the compilation's one `TypeTable`, so type equality is an integer compare. `types.ts` holds `llvmType`, `alignOf`, `assignable` and the numeric predicates (two types are the same type when their ids are equal); `annotations.ts` turns a written annotation into a type id. |
| Checker | `self/checker.ts` + `declarations.ts`, `structs.ts`, `constants.ts`, `assignment.ts` (definite assignment), `statements.ts`, `expressions.ts`, `members.ts`, `arrays.ts`, `builtins.ts`, `result.ts`, `generics.ts`, `bounds.ts`, `symbols.ts`, `context.ts` | Pass 1 collects signatures and struct layouts; pass 1b binds imports; pass 2 checks bodies. Every statement and expression goes through the central `switch` of its category (see below) and its type is recorded in a side table. |
| Diagnostics | `self/diagnostics.ts`, `self/codes.ts` | The `file:line:col: error: message` summary, the caret excerpt and the `--json` object; `codes.ts` is the hand-kept registry of every diagnostic code. |
| Attributes | `self/attributes.ts` | Per-function facts (loops, memory effect, escapes, pointer-parameter facts, allocation facts) and the call-graph fixpoint that turns them into LLVM attributes, arena scopes, and stack slots. Runs over the whole program at once. |
| Escape analysis | `self/escape.ts` | Per allocation site (`new`, object literal, array literal, `new Array<T>(<literal>)`, `Ok(v)` / `Err(e)`): does the value stay `local`, is it `returned`, or does it `leak`? Decides stack allocation and feeds the arena-scope facts (WP6). |
| Target | `self/target.ts` | The `--target` table: canonical triples, their aliases, `host` resolution from `process.platform`/`arch`, and the clang 18 data-layout string written into the module header (WP9). |
| Emitter | `self/emit.ts` + `emit_util.ts`, `emit_ops.ts`, `emit_control.ts`, `emit_strings.ts`, `emit_arrays.ts`, `emit_classes.ts`, `emit_builtins.ts`, `emit_result.ts`, `tbaa.ts`, `debug.ts` | Lowers the checked program to IR text: module assembly, function setup, `declare`s for imports, the `@main` wrapper, the runtime prelude, and dispatch to per-construct lowerings. Contains no user-facing error handling. |
| IR builder | `self/ir.ts` | `IRModule`, `IRFunction`, `IRBlock`: named blocks, hoisted allocas, SSA temp numbering (`%0` is always the first temp because every block and parameter is named), attribute-group interning. |
| Runtime ABI | `self/runtime.ts` | The `declare` lines, attributes, and memory effects of every runtime symbol and intrinsic (the `RuntimeTable`); the IR text of the inline arena allocator; the `%struct.nish_arena` / `%struct.nish_array` layouts. |
| Runtime | `runtime/runtime.c`, `runtime/runtime_os.c`, `runtime/nish.h`, `runtime/runtime_wasm.c` | The C implementation, in two translation units so that each carries its own code-size ceiling. `runtime.c` is what every program touches whatever it does: the chunked bump arena with marks (`nish_arena_mark` / `release` / `used`), strings, number formatting, `Math.random`, `process.argv`, array growth and `nish_alloc_array` (the host entry the wasm loader uses), the bounds-check and division panics. `runtime_os.c` is everything that wraps a system call — `process.exit`, files, directories, subprocesses, `getenv`, the monotonic clock, `process.platform` / `arch` — which is the surface that grows as the language reaches further into the operating system. The header is the public C ABI for both. `runtime_wasm.c` is the freestanding subset (arena over linear memory, arrays, trapping panics) for the wasm profile. `runtime/shim.mjs` is the Node-side twin used by the differential tests. `runtime/nish.d.ts` declares the builtins so that `tsc` can type-check a Nish program. |
| Interop | `self/interop_abi.ts`, `interop_header.ts`, `interop_dts.ts`, `interop_wasm.ts`, `interop_napi.ts` | C header, wasm `.d.ts` and its loader, and N-API shim generators, all derived from the same checked signatures the IR was emitted from. |
| Dumps | `self/dump.ts`, `self/ast_text.ts` | The `--emit-checked` and `--emit-ast` text. |
| Build | `scripts/build.sh`, `size-report.sh`, `smoke.sh`, `bootstrap.sh`, `fetch-seed.sh` | The clang/LTO profiles, the size table, the example smoke test, and the seeded build of the compiler itself. |
| Tests | `tests/run.js` + `tests/{cases,link,ir,layout,self}`, `tests/runtime_test.c`, `tests/driver.c` | Goldens, native round trips, link tests, ABI guards, memory checks, interop, exit codes, packaging, the bootstrap, benchmark checksums. |
| Differential tests | `tests/differential/{run,lib,fuzz}.js`, `tests/differential/corpus/`, `tests/differential/goldens/`, `runtime/shim.mjs` | Every whole program compiled natively and compared, byte for byte, with its frozen JavaScript rewrite run under Node; a seeded random-program fuzzer (WP13). |
| Bench | `bench/run.mjs`, `bench/*.{ts,c,rs}`, `bench/rss.c`, `bench/ffi.mjs` | The Nish / C / Rust suite that writes `docs/BENCHMARKS.md` (WP9), and the interop batching benchmark (WP8). |

### Bootstrapping

`self/` is a Nish program, so building it needs a Nish compiler: the last
released `nish` binary, which is the seed. `scripts/fetch-seed.sh` downloads
that release's tarball into `build/seed/`, and `NISH_BOOTSTRAP=<path>`
points at another one. `scripts/bootstrap.sh` (what `npm run build` runs)
builds the chain:

```
seed ──▶ stage1 (self/ built by the seed) ──▶ stage2 (self/ built by stage1) = build/nish
                                                └─▶ stage3 (self/ built by stage2), --verify only
```

`--verify` asserts `IR(stage1) == IR(stage2)` and stage3 == stage2 byte for
byte. `IR(seed) == IR(stage1)` is reported and not asserted: it asks whether
the codegen has changed since the release, and a codegen change is expected
to move it.

The consequence for every change is the **rolling freeze**: `self/` may
*use* in its own source only what the seed compiles. A new construct is
implemented in `self/` and may be written inside `self/` from the next
release on. CI's `bootstrap` job is what checks the freeze, by building
stage1 from the released seed at all.

## Side tables: the checker records, the emitter reads

The checker never rewrites the AST and the emitter never re-derives a type.
Everything the emitter needs is written into `CheckedProgram`
(`self/program.ts`), in arrays indexed by `Node.id`, so that no node is ever
mutated. The parser hands out dense ids as it builds the tree, so each
table's size is known before the checker starts:

| Table | Key | Value | Who writes | Who reads |
| --- | --- | --- | --- | --- |
| `nodeTypes` | any expression node | its type id | every expression checker | `typeOf` in every lowering |
| `nodeLocals` | identifier node | the `Local` it refers to (parameter or local slot) | identifier/assignment checkers | identifier lowering (SSA value vs. `load` from a slot), escape analysis |
| `nodeConstants` | identifier node | the module constant it names, when it is not a variable | identifier checker | constant lowering |
| `nodeCallees` | call node | the `FunctionSig` called (free functions and methods) | call checkers | call emission, call-graph facts |
| `nodeBuiltins` | call or identifier node | the canonical builtin a `nish:` import resolved to | import binding, call checkers | builtin lowering |
| `nodeCoercions` | expression node | the type a class value *was* where an implemented interface is expected | contextual-type check | one `bitcast` at the use site |
| `nodeCaseValues`, `nodeEnumValues` | `case` label / enum member node | the folded constant | `constants.ts` | `switch` and enum lowering |
| `nodeProvenIndex`, `nodeProvenClamp` | index and `substring` bound nodes | the bounds analysis proved it in range | `bounds.ts` | `emit_arrays.ts`, `emit_strings.ts`, and the attribute pass |
| `structs`, `functions`, `imports`, `exports`, `entryMain` | – | struct layouts, signatures in source order, import bindings, exported names, the entry `main` | pass 1 / 1b | GEP indices, `sizeof`, `dereferenceable`, function emission, `declare`s, the `@main` wrapper |

Consequences:

- The emitter can assume every node it sees is valid, so the `emit_*.ts`
  modules have no diagnostics at all; an unexpected node there is an internal
  error (`panic`, exit 70), never a user error.
- Whole-program facts live *outside* the AST: `analyzeFunctions` returns a
  `FactsTable` over every module, and the emitter of each module reads the
  same table, which is why an importer's `declare` carries exactly the
  exporter's attributes (`tests/link/*` check this attribute for attribute).

### Dispatch

Both phases dispatch through one central `switch` on the node kind per
syntactic category (wp14 §3a D2), and the family modules hold the handlers:

| Checker (`self/`) | Emitter (`self/`) | Switches on |
| --- | --- | --- |
| `checkStatement` (`statements.ts`) | `Emitter.emitStatementKind` (`emit.ts`) | statement kind |
| `checkExpression` (`expressions.ts`) | `Emitter.emitRawExpression` (`emit.ts`) | expression kind |
| binary and unary operators (`expressions.ts`) | `emitBinary`, `emitUnary` (`emit_ops.ts`) | operator token |
| `checkMemberAssignment` (`members.ts`), `checkIndexAssignment` (`arrays.ts`) | `emitAssignment` (`emit_ops.ts`), `emitFieldAssignment` (`emit_classes.ts`), `emitElementAssignment` (`emit_arrays.ts`), `emitCompoundAssignment` (`emit_control.ts`) | kind of the assignment *target* (`p.x = v`, `a[i] = v`) |
| `checkMember`, `checkMethodCall` (`members.ts`), then `checkArrayProperty`, `checkStringProperty`, `checkResultProperty` | `emitMethodCall` (`emit_classes.ts`), `emitArrayMethodCall`, `emitStringMethodCall`, `emitResultProperty` | receiver type kind (`string`, `array`, `struct`, `result`) |
| `checkBuiltinCall`, `checkNamespaceProperty` (`builtins.ts`) | `emitBuiltinCall`, `emitIdentifierBuiltinCall`, `emitNamespaceProperty` (`emit_builtins.ts`) | dotted name (`console.log`, `Math.*`, `process.exit`) or bare builtin, consulted only when no user function has that name |

Nish-0 has no function values, so there are no tables of closures: the
emitter is one `Emitter` class that the family modules are handed, and a new
construct is a new `case` in the switch plus a function in its family.
Narrowing is `narrow` in `expressions.ts`, which `T | null` guards and
`result.ts`'s `narrowResultTest` both go through.

## How to add a construct

The checklist every work package follows (MASTER_PLAN.md §7). A construct is
implemented once, in `self/`, and the tests, the rule and the changelog line
are what make it part of the language. Under the rolling freeze
([Bootstrapping](#bootstrapping)) `self/` may not *use* the construct in its
own source until the seed compiles it, which is the next release.

1. **Decide the rule and the lowering first.** Write the TypeScript snippet
   and the IR you expect by hand; check it with `llvm-as` and
   `opt -passes=verify`.
2. **Parser and validator.** New syntax needs a node kind in `self/nodes.ts`
   (with its child layout written beside it) and a production in
   `self/parser.ts`. If the construct can *never* be compiled, add a rule to
   `self/validator.ts` and a `tests/cases/reject_<x>.ts` + `.err`. If it is
   merely unsupported today, leave the validator alone: the checker's
   `Unsupported ...` fallback covers it.
3. **Types.** New type? Add its id or kind to `self/types.ts` and extend
   `llvmType`, `alignOf` and `assignable` there, the annotation
   resolver in `self/annotations.ts`, and `cType` / `tsKeyword` in
   `self/interop_abi.ts`. A numeric type also touches `isNumeric` plus
   `isInteger` (and `isUnsigned`/`intBits` for an integer width) or `isFloat`,
   the constant encoding in `numericConstant` (`self/emit_ops.ts`), `wasmType` and
   the bridging decision in `self/interop_wasm.ts`, the scalar readers and
   boxers in `self/interop_napi.ts`, and the basic-type table in
   `self/debug.ts`. The N-API tables are the ones to remember: a type with no
   row there does not make the shim refuse a signature that mentions it, it
   makes the shim leave that function out of the addon, which is how `u8`,
   `u16`, `u32`, `u64` and `f32` were unbridged for as long as they were.
4. **Checker.** Add a `case` to the category's `switch` and write the handler
   in the matching family module (or a new one); record every type and binding
   the emitter will need in the `CheckedProgram` side tables; give every
   rejection a message that names the construct. A statement that cannot fall
   through returns `true` from `checkStatement`.
5. **Diagnostics.** A new diagnostic is an entry added by hand to
   `self/codes.ts`, with the next free number in its band; never renumber or
   reuse a code. `scripts/gen-diagnostic-codes.mjs` is frozen: `--check`
   validates the registry's format and that every code is unique, and writes
   nothing. The diagnostic also needs a program that *reaches its words*
   (`tests/wordings/`, checked by `tests/diagnostic_coverage.js` inside
   `npm test`), or a line with a reason in `tests/wordings/unreachable.txt`.
6. **Emitter.** Add the `case` to `self/emit.ts` and the lowering to its
   `emit_*.ts` family; read only the side tables; name every new basic block;
   hoist allocas with `emitAlloca`; reference runtime symbols only through
   `useRuntime` so the declaration is emitted.
7. **Runtime.** New C symbol? Add it to the `RuntimeTable` in
   `self/runtime.ts` (signature, attributes, effect, `noreturn`), to the
   runtime, and to `runtime/nish.h`; `tests/run.js` fails if the three
   disagree. The runtime is two translation units: a symbol that wraps a system
   call goes in `runtime/runtime_os.c`, everything else in `runtime/runtime.c`.
   Any struct layout change touches `self/runtime.ts` and `runtime.c` in the
   same commit and extends a layout test. Keep each file within its budget —
   every `.text*` section summed, at `-Oz`, under 3,584 bytes for `runtime.c`
   and 1,280 for `runtime_os.c` (§2 of the master plan, and
   [wp7-runtime.md](wp7-runtime.md) for each measurement, why the ceilings are
   separate and why either moved). `node tests/run.js budget` measures both, so
   this is a check you can run rather than a number to remember;
   `clang -Oz -c <file> && size -A <file>.o` is the same measurement by hand.
   A link line names only `runtime.c`: `scripts/build.sh` compiles
   `runtime_os.c` beside it, and a direct `clang` line names both.
8. **Attributes.** Tell the fact collector in `self/attributes.ts` what the
   construct does: memory effect (`readsMemory`, the callee symbols the
   `collect*Facts` methods record), escapes
   (`classifyUse`), loop boundedness (`isCountedLoop`). Never add an attribute
   you cannot cite a proof for; write the reason next to the code.
9. **Tests.** A golden `tests/cases/<name>.ts` + `.ll` (`npm run test:update`
   writes a missing golden), an `llvm-as` pass, a native round trip (`.out`,
   using `tests/driver.c`'s `test()` or an `export const main`), at least one
   `reject_*` case, and `.args` for flags.
10. **Docs.** Add the rule to [LANGUAGE.md](LANGUAGE.md) with the test-case
    citation, a snippet to `docs/cookbook/` with a marker in
    [IR_COOKBOOK.md](IR_COOKBOOK.md), and a line to `CHANGELOG.md`. The
    cookbook is regenerated by `docs/cookbook/regen.sh` against `build/nish`,
    the compiler the change itself builds, so the entry is written in the same
    pull request as the construct rather than a release later.

## ABI contracts and the tests that guard them

Everything shared between the IR the compiler emits, the C runtime, and a
host is a contract that a test enforces:

| Contract | Defined in | Guarded by |
| --- | --- | --- |
| Arena state `%struct.nish_arena = { i8* buf, i64 off, i64 cap, i8* chunks }`, bumped directly by the inlined fast path. `off` and `cap` are `uint64_t` on the C side, never `size_t`: the IR says `i64` on every target, and under wasm32 a `size_t` pair would sit at bytes 4 and 8 instead of 8 and 16 | `self/runtime.ts` (`ARENA_TYPE`, `inlineAllocator`), `runtime.c` (`struct nish_arena`), `runtime_wasm.c`, `nish.h` | **alloc smoke** (`tests/ir/alloc_smoke.ll` + `alloc_smoke_main.c`): the `--runtime-decls` prelude plus an IR function that allocates twice is linked against `runtime.c` with LTO and must observe a 16-byte bump for two 12-byte objects (`tests/run.js`, section B). The offsets themselves are `_Static_assert`ed in both runtimes and, per target, in the header layout check that compiles `nish.h` for the host and for wasm32 |
| String `{ i64 len, i8 data[len], i8 0 }`, 8-aligned, immutable | `self/emit_strings.ts`, `runtime.c` (`nish_str`), `nish.h` | `tests/runtime_test.c` (concat, eq, formatting), every `str_*` golden and native round trip |
| Array header `%struct.nish_array = { i64 len, i64 cap, i8* data }` | `self/runtime.ts` (`ARRAY_TYPE`), `runtime.c`, `runtime_wasm.c`, `nish.h`, `self/interop_wasm.ts` (offsets 0 / 16 on wasm32) | `tests/runtime_test.c` (`nish_array_grow`, `nish_alloc_array`), `arr_*` native round trips, `arr_bounds_panic` (exit 1 and message), the WP4/WP8 block of `tests/run.js` (a C driver's stack-built header, the wasm loader and the N-API addon agreeing on `examples/arrays.ts`) |
| Class/interface layout = clang's layout of the same C struct | `self/structs.ts` (offsets, size, align) | **layout test** (`tests/layout/structs.ts` + `structs.c`): the runner reads each `nish_alloc_struct(i64 N)` from the IR and compares it with `_Static_assert(sizeof(struct X) == N)`; the C program is built with `-Wall -Wextra -Werror`, fills every struct through the C definition, and reads each field back through compiled getters |
| Element storage of an array: `sizeof(T)` per slot, and for a *record* element type (an `interface` nobody implements, WP15 §2a) the records themselves end to end, at clang's array stride | `self/program.ts` (`inlineElementStruct`, `elementStride`), `self/emit_arrays.ts`, `runtime.c` (`nish_array_grow`, `nish_alloc_array` take `elem_size`), `nish.h`, `self/interop_header.ts` (the element note per prototype) | the same **layout test**: `buildPs` hands C a grown `P[]`, which `structs.c` walks as a `struct P *`, checking the stride and every field of every element, plus `tests/cases/arr_struct_*` for the IR and the native round trip |
| Every runtime function has a prototype in the public header | `self/runtime.ts`, `runtime/nish.h` | **header test** (`tests/run.js`, WP8 section): every runtime function in the `RuntimeTable` (minus intrinsics) plus `nish_arena` must appear in `nish.h`, which must compile as C11 `-pedantic` and as C++17 under `-Wall -Wextra -Werror` |
| Generated C header matches the IR's signatures | `self/interop_header.ts` | `add.h` content check; a C driver compiled against it with `-Werror` and run |
| Generated `.d.ts` is valid TypeScript | `self/interop_dts.ts` | `tsc` over the generated file |
| N-API shim and wasm build agree | `self/interop_napi.ts`, `build.sh --profile napi/wasm` | addon build, load, type-check errors, `.node` vs `.wasm` results |
| Importer `declare` = exporter `define` attributes | `self/attributes.ts`, `self/emit.ts` | every `tests/link/*` positive test compares the attribute sets across modules |
| Entry wrapper and exit codes | `self/emit.ts` (`emitEntryWrapper`), `self/compile.ts` | `entry_main*` goldens, `tests/link/*` expected exit codes, the WP12 exit-code block (ICE hook, missing toolchain, failing `build.sh`) |
| C ABI of scalars (`int32_t`, `double`, `bool` zero-extended) | `self/interop_abi.ts` | `examples/main.c` driver in the size-profile check, `tests/driver.c` in every `.out` case |
| Package contents (`bin/`, `runtime/`, `scripts/`, `std/`, `LICENSE`, `docs/INSTALL.md`); the compiler itself comes from the platform package `@amritk/nish-<asset>` | `package.json#files`, `optionalDependencies` | the WP12 package block: `npm pack`, install into a temp prefix, link a hello-world from another directory |

The rule behind the table (MASTER_PLAN.md §2): any change to a struct layout
touches `self/runtime.ts` and `runtime.c` in the same commit and adds or extends
a layout smoke test.

### Runtime symbols

`runtime/runtime.c` (3,515 bytes of `.text*` at `-Oz` against a budget of
3,584, plus 10,068 bytes of `.rodata` that is almost all Ryu's two
power-of-five tables) and `runtime/runtime_os.c` (the system-call half: 1,251
bytes against 1,280) provide, in the order of the `RuntimeTable` in `self/runtime.ts`, the symbols
below; measure either with `clang -Oz -c <file> && size -A <file>.o`, or
`scripts/size-report.sh`, which reports every row:

| Symbol | Purpose |
| --- | --- |
| `nish_alloc_struct(size)` | Bump allocation, 8-byte rounded and aligned, uninitialised. The compiler never calls the C version: it emits its own `alwaysinline` copy of the fast path into every module that allocates (`--runtime-decls` shows it), and only the overflow path calls `nish_arena_grow`. |
| `nish_arena_grow(size)` | Slow path (`cold noinline`): push a new chunk (at least 64 KB) and bump from it; out of memory prints `nish: out of memory` and exits. |
| `nish_reset_arena()` | Recycle everything in O(1): keeps the newest chunk, frees the rest, so a steady-state program stops calling `malloc` at all. |
| `nish_free_arena()` | Release all chunks; the entry wrapper calls it when `main` returns. The arena is lazy, so it can be used again afterwards. |
| `nish_arena_mark()` | The current bump address `buf + off` as one `i64` (`0` while the arena is empty), which identifies both the chunk and the offset. Emitted at the top of every function with an automatic arena scope; `Arena.mark()` (WP6). |
| `nish_arena_release(mark)` | Rewind to a mark: `mark == 0` acts like `nish_reset_arena`; a mark in the current chunk resets `off`; a mark in an older chunk frees every newer chunk first; a mark in no live chunk (stale, undefined behaviour by the language rule) is ignored. Emitted before every `ret` of a scoped function; `Arena.release(m)`. |
| `nish_arena_used()` | Bytes bumped in the current chunk; `Arena.used()`, the number the `mem_*` tests watch. |
| `nish_str_new(bytes, len)`, `nish_str_concat`, `nish_str_eq`, `nish_str_len`, `nish_print`, `nish_str_from_i32 / i64 / u64 / f64` | Length-prefixed, NUL-terminated, immutable UTF-8 strings in the arena; `from_f64` prints exactly what JavaScript's `String(x)` prints (shortest round-trip digits). `from_u64` is the one unsigned formatter: `u8`/`u16`/`u32` are `zext`ed to i64 at the call site, so four widths need one symbol and one shared digit loop (WP15). `nish_str_len` exists for C hosts; compiled code loads the header directly. |
| `nish_random()` | `Math.random`: xorshift64\*, seeded lazily from time and pid, 53 random bits in `[0, 1)`. |
| `nish_exit(code)` | `process.exit`, via libc `exit`. |
| `nish_read_file / nish_write_file / nish_append_file` | `readFileSync` / `writeFileSync` / `appendFileSync`: `open`/`pread`/`write` syscalls, the whole file in one arena string; a failure prints `nish: cannot read <path>` (or `cannot write`) and exits 1. |
| `nish_mkdir(path)` / `nish_spawn(argv)` | `mkdirSync` / `spawnSync` (WP14 D4), the two calls a self-hosted driver needs to link its own output. `nish_mkdir` creates one directory, not recursively, and answers whether a directory is there afterwards (`mkdir`, then a `stat` when that failed). `nish_spawn` runs `argv[0]` through `PATH` with `posix_spawnp`, waits, and answers the exit status, `128 + signal`, or `-1` for an empty vector, a program that would not start, and every WASI build. Both answer instead of exiting, as `nish_read_file_or_null` does. `nish_spawn` is the one runtime function whose pointer parameter is not `nocapture`: it keeps pointers into the vector's strings. |
| `nish_getenv(name)` | `getenv` (WP19 R1): the value of one environment variable, copied into the arena, or NULL when it is unset — the `string \| null` a driver reads `CC` with before it spawns `scripts/build.sh`. The copy is what makes the answer an ordinary arena string: libc hands back a pointer into `environ`, which a later `setenv` may move. `noalias` on the declaration for that reason and `readnone` on none of it: it allocates, and the environment is not memory LLVM tracks. |
| `nish_array_grow(hdr, elemSize)` | `push` when `len == cap`: doubles `cap` (4 from 0) and moves the elements to fresh arena storage. |
| `nish_panic_index(idx, len)` | Failed bounds check: `index out of range: <idx> >= <len>` on stderr, `_exit(1)`. |
| `nish_panic_slice(start, end, len)` | Failed `slice` range check (`cold noreturn`): `slice out of range: [<start>, <end>) of length <len>` on stderr, `_exit(1)`. Its own symbol because a reversed pair is as common a mistake as an end past the string, and `index out of range` describes neither (WP15 §4). |
| `nish_panic_div(by_zero)` | Failed integer-division check (`cold noreturn`): `attempt to divide by zero` or `attempt to divide with overflow` on stderr, `_exit(1)`. |
| `nish_parallel_range(body, ctx, len, grain)` | `runtime/runtime_parallel.c`, the third translation unit with its own budget: runs `body(lo, hi, ctx)` over a partition of `[0, len)` into contiguous chunks, at most `nish_cpu_count()` of them and never more than `len / grain`, chunk 0 on the calling thread, and returns when all have run; without `-DNISH_THREADS`, and on WASI, the whole range runs on the calling thread. What a `parallelMapInto` or `parallelReduce` from `nish/threads` lowers onto (WP29 P1, `self/emit_parallel.ts`). `nounwind` only: it runs whatever the body does, so it is a shared write and not `willreturn`. |
| `nish_cpu_count()` | The online CPU count, read once and cached in a relaxed atomic word; the partitioner's own question, declared because `nish.h` publishes it. No compiled code calls it. |

`Math.sqrt`, `Math.floor`, `Math.abs`, `Math.min`, ... are not runtime calls
at all: they lower to LLVM intrinsics (`llvm.sqrt.f64`, `llvm.smin.i32`,
...) declared `readnone willreturn`, so a function built from them stays
pure. Runtime declarations are emitted only for the symbols a module
actually uses (`--runtime-decls` forces all of them), so a pure-math module
links with nothing but libc.

Arena state is one global that the IR reads directly, and after inlining an
allocation of a fixed-size struct is two loads, an add, a compare, and a
store:

```llvm
%struct.nish_arena = type { i8*, i64, i64, i8* }   ; { buf, offset, capacity, chunk list }
@nish_arena = external global %struct.nish_arena, align 8
```

```asm
movq  8(%r14), %rbx      ; offset
movq  16(%r14), %rcx     ; capacity
leaq  16(%rbx), %rax     ; offset + sizeof(struct)
cmpq  %rcx, %rax
ja    .slow              ; cold: call nish_arena_grow
movq  %rax, 8(%r14)      ; commit
addq  (%r14), %rbx       ; object = buf + old offset
```

## Attribute soundness rules

`self/attributes.ts` emits an LLVM attribute only when the checker's
facts prove it; a wrong attribute is undefined behaviour, not a missed
optimisation. The facts per function (`FunctionFacts`) are collected in one
AST walk and then refined by a fixpoint over the whole program's call
graph: a function is as impure as the most impure callee, `willreturn` only
if every callee is, and a pointer parameter is written/captured if any
callee it is passed to writes/captures the matching parameter (unknown
callees count as both). The fixpoint is optimistic on cycles, which is sound
because a parameter is only ever marked written when an actual store reaches
it.

| Attribute | Emitted when | Proof |
| --- | --- | --- |
| `nounwind` | always | No exceptions exist and there is no `throw`; a failure a caller should handle is a `Result<T, E>` (WP16). |
| `willreturn` | `loopsBounded && !hasTrap && !callsNoReturn` and every callee `willreturn` | Counted loops only (`isCountedLoop`: `for (let i = init; i CMP bound; STEP)` over `i32`, bound an identifier or non-negative literal, step toward the bound, no wrap possible, body assigns neither `i` nor `bound`; `for...of` whose body cannot extend the array); `process.exit`, `panic`, a checked `a[i]` (`nish_panic_index` is `noreturn`), and an integer `/` or `%` (`nish_panic_div`) clear it — a *proven* `a[i]` does not, because the checker showed the index in range and no check is emitted (WP15 §2, `self/bounds.ts`). Unbounded recursion is allowed by LangRef. `mustprogress` is never emitted. |
| `readnone` | effect `none` | The body touches no memory but its own allocas and calls only `readnone` callees (LLVM's own FunctionAttrs would infer it). |
| `readonly` (function) | effect `read` | The body reads memory it does not own (`.length`, field/element reads, a `Result` payload, `nish_str_eq`) and nothing writes; building a `Result`, a checked `a[i]`, and an integer division force `write` (the allocator and the panic callees are `write`). Field access through a local that only ever holds a stack object (`stackLocals`) is the function's own memory and counts as neither (WP6). |
| `noundef` (params, returns) | every shape but one | Every Nish value is initialised. The exception is a by-value `Result` under the private ABI (WP15 §7b): the arm that is not live is `undef` by construction, and `noundef` on an aggregate is about every element of it, so that shape carries none. |
| `zeroext` | `boolean` | C ABI for `bool`. |
| `nonnull align 8` | non-nullable strings, arrays, structs | No null value in those types; literals, arena objects, and stack objects are 8-aligned. A `T \| null` parameter or return keeps `align 8` (null is aligned) and loses `nonnull` and `dereferenceable` (WP6). |
| `dereferenceable(sizeof)` / `dereferenceable(24)` | non-nullable struct params/returns (non-empty) / non-nullable array params and returns | Every object comes from the arena or a stack slot with at least `sizeof` bytes; every array value comes from a literal, `new Array`, or a function that returned one, all of which write the full 24-byte header (WP9). |
| `readonly` (string param) | always | Strings are immutable. |
| `!tbaa` (class field load/store) | the struct is a class that implements no interface | Struct-path TBAA: a field is named by its class, its LLVM type and its byte offset, so a store to one field cannot be a load of another whatever the two pointers are. Sound because Nish has no inheritance, no casts, no unions and no pointer arithmetic, so a `%struct.C*` is the only type through which a `C` object's bytes are read or written. `implements` is the exception — it lays an interface's fields out first so `%struct.C*` may be `bitcast` to `%struct.I*`, real prefix subtyping — and those accesses carry no tag at all. Worth 87.5M instructions to 80.0M on `bench/nbody` (`self/tbaa.ts`). |
| `noalias` (string param) | always | Nothing writes through a string pointer, and `noalias` only concerns modified memory. |
| `noalias` (`%this`) | constructors only | `new` hands the constructor a fresh allocation; never on other struct params (two may alias). |
| `readonly` (struct/array param) | `!writesThrough` after the fixpoint | No store through the pointer, no escape, only passed to `readonly` parameters. Array element stores through nested indexing count as writes, conservatively. |
| `nocapture` | strings: `!escaping`; pointers: `!captured` after the fixpoint | `classifyUse`: a use is harmless when consumed on the spot (operator operand, condition, `.length` receiver, template hole that concatenates, runtime builtin argument, all declared `nocapture`); it escapes when returned, stored, aliased, pushed, or passed to a capturing user function. Strings passed to a user function always escape (no fixpoint for strings). |
| no `nocapture`, no `readonly` (params) | a `parallelMapInto` or `parallelReduce` instance from `nish/threads` (WP29 P1) | Its region stores every parameter into a context block whose address `nish_parallel_range` hands to other threads, which write `dst` through that copy. The source walk sees a direct call instead, so `markParallelEntry` (`self/attributes.ts`) adds the runtime callee and marks every parameter escaping, written through and captured. The chunk loop the region runs is an ordinary instance and keeps its own attributes. |
| runtime `declare` attributes | from the `RuntimeTable` | Written next to each symbol in `self/runtime.ts`; intrinsics carry a subset of what LLVM itself attaches (`nounwind willreturn readnone`). |
| `alwaysinline allocsize(0)` / `cold noinline allocsize(0)` | the inline allocator / `nish_arena_grow` | The fast path must inline; the slow path must not. |
| `tail` (call marker, not an attribute) | a `return g(...)` whose arguments are every one a scalar, whose callee's parameter count matches the argument list, and which nothing follows (no packed-`Result` unpack, no WP9 reclaim, no scope release left behind) | The marker claims the callee cannot access the caller's stack frame. It holds because the callee is handed no pointer at all, and because no other path reaches a caller alloca either: the only allocas a function has are its locals' slots, whose addresses are never materialised as values, and the WP6 stack sites, which exist only for allocations whose flow is `local` and so are never stored, captured or returned. The proof is `marksTailCall` in `escape.ts` rather than `attributes.ts`, because it is a fact about one call site rather than about a function, and it is the one entry in this table `--plain` keeps: it decides whether a deep recursion runs at all rather than how fast it runs. |
| `!alias.scope` / `!noalias` (array accesses) | every load and store of an `nish_array` header field, and every load and store of element data | The header's three fields and the `cap * sizeof(T)` of element storage never overlap, in any of the four shapes the compiler produces them: two arena bumps, two entry-block allocas (WP6), the `nish_alloc_array` host entry (two bumps again), and `nish_argv_init`'s single `malloc` block whose elements begin *after* the header. So an element store cannot reach a header field, nor the reverse. Strings are excluded — one block, length and bytes contiguous. Struct fields were excluded too, for want of a measurement; they have one now and carry `!tbaa` instead, above. WP15 §2b; the argument is written out in `self/emit_arrays.ts`. |
| `!tbaa` (array element load/store) | every load and store of an element slot that holds a value; never an inline record's slot, which is an untagged `llvm.memcpy` | The tag is `element <type>`, a sibling of the field scalars under the root rather than a child of one, so an element access is NoAlias with every tagged class field access, pointer-typed fields and elements included: that is what lets LLVM keep `this.v` and its header live across `this.v[i] = x` (after `opt -O3` AWFY Permute's swap loads `this.v` once where it loaded it twice). Sound because element storage and a class object are distinct allocations that never share a byte while both are live — a data block is an arena bump, an entry-block alloca, a `nish_alloc_array` block or the tail of `nish_argv_init`'s `malloc`; a class object is a `nish_alloc_struct` bump, a WP6 stack alloca, or a WP17 unpacked `Result`, which is its own object too and whose accesses carry no tag. Arena reuse does not break it: the bytes change hands only across `nish_arena_release` / `Arena.reset`, calls with no memory attribute that LLVM orders every access to escaped memory against, and an object that never escaped is dead by then. The one object that does live in element storage is an **inline record** (WP15 §2a: an interface nothing implements), and neither side of that overlap is tagged: its fields are read and written with no `!tbaa` (interfaces never get one, above) and a slot is written whole by `llvm.memcpy`, so a record element store still aliases the record's field accesses (`tests/cases/arr_field_reload_records`). Two element types never share a slot either, since there is no cast and no view of one array's storage as another's; `--threads` changes where the arena state lives, not which allocation an access reaches. `self/tbaa.ts` (`elementTbaa`), guarded by `tests/run.js` on `arr_field_reload`. |
| `!tbaa` (array header load/store) | every load and store of an `nish_array` header's `len`, `cap` or `data`, all of which go through `loadHeaderField` / `storeHeaderField` in `self/emit_arrays.ts` (push and pop included) | The tag is `array header`, a struct node whose three fields hang off two scalars nobody else uses (`header i64`, `header ptr`), under the same root as the class paths and the `element <type>` nodes. No class can be named with a space, so no struct path reaches it: a header access is NoAlias with every tagged class field access and every element access, and that is what keeps `this.piles`'s `len` and `data` live across `top.next = null` (after `opt -O3` AWFY Towers' inlined `moveTopDisk` loads each once per move where it loaded each three times). Sound because **every write of a header's bytes carries this tag or sits behind a call**. *Nish IR*: a header is written only by `emitHeader` and `storeData` (`new Array`, a literal: `len`, `cap`, then `data`), `push` (`len`) and `pop` (`len`); there is no other store, since `a.length = n` is refused (`reject_arr_length_assign`) and `process.argv` cannot be pushed or popped (`reject_argv_pop`). The inline allocator (`nish_alloc_struct`) writes the arena's state, untagged, and hands back bytes the tagged stores then fill. *C*: `nish_array_grow` (`cap`, `data`), `nish_alloc_array`, `nish_readdir` and the `push` it makes in `runtime_os.c`, `nish_argv_init`, a C host's `nish_array a = { n, n, buf }` and the N-API shim's borrowed header are all reached through a call. A call carries no `!tbaa`, so TBAA says nothing about it; under `-flto` the inlined C carries clang's own root, and LLVM answers MayAlias for two tags whose roots differ. The wasm loader writes a header from JavaScript before the call that reads it. *Stack arrays* (WP6): the header is an entry-block `alloca`, written by the same tagged stores, and `nish_array_grow` on it is still a call (`arr_header_tbaa_stack`). LLVM's stack colouring may give two allocas one slot, and when it does it drops the AA metadata of every access to the merged slot. *Inline records* (WP15 §2a) live in element storage, never in a header, and an array field of a record holds a pointer to a header rather than a header, so the untagged record stores and the untagged `llvm.memcpy` that writes a record slot never touch one (`arr_header_tbaa_records`). No header is ever copied by `llvm.memcpy`: `nish_array_grow` moves the element data, not the header. *`Result`* objects, WP17's unpacked ones included, hold a header's pointer as a payload and are objects of their own. *Arena reuse*: the bytes of a header change hands only across `nish_arena_release` / `Arena.reset`, calls LLVM orders every access to escaped memory against, and reading a header after its arena is released is undefined behaviour already (the `Arena.release` safety rule in `docs/LANGUAGE.md`). *`--threads`* moves the arena into thread-local storage and changes no header access (`arr_header_tbaa_threads`). The one surface that shares arrays between threads, a `nish/threads` region (`parallelMapInto`, `parallelReduce`), writes no header while it runs: its body may write nothing its caller can see (`FunctionFacts.sharedWrite`, `self/parallel.ts`), so no worker pushes or pops a shared array, and the only stores are the intrinsic's, into `dst`'s element slots. Workers only read the shared headers, and `nish_parallel_range`, which joins every thread before it returns, is a call. A racing write would be undefined behaviour with or without a tag. A later change that puts a header anywhere else (inside a class object, say) keeps this argument only if that header is still read and written through `loadHeaderField` / `storeHeaderField` and never through a class-field path. `self/tbaa.ts` (`headerTbaa`), guarded by `tests/run.js` on `arr_header_tbaa`, which also links the five negatives `-O3 -flto` with the runtime's C inlined. |
| no `nish_panic_index` check (call-site ranges, WP15 §2.4) | an access `self/ranges.ts` proves once every body is checked, from a callee summary or the facts a function is entered with; written to `nodeProvenIndex` beside pass 2's proofs | **Who takes entry facts.** Only a function every call to which is visible, which `hostVisible` in `self/visibility.ts` decides, from the declaration and the build mode, in one place. Never the entry point, which the runtime calls, a `hidden` function, a constructor, an instantiation, a lifted arrow or a function taking a compile-time function. An exported function or a method of an exported class takes them only in a **closed-world build**: `--link` (the compiler writes the final executable, from every module of the program, in this invocation), a native profile and triple (not `--profile wasi`, not a wasm `--target`), no sidecar (`--emit-header`, `--emit-dts`, `--emit-napi`, `--emit-napi-async`), and no `declare function` in any module. That is sound because such a link holds exactly the emitted modules and the runtime (`scripts/build.sh` is handed nothing else, and the CLI takes no C file or object), the runtime calls into the program only at `nish_main` and at a `nish/threads` chunk (an instantiation), and a Nish function is never a value, so no other caller can exist: `export` then means only "importable", and the importers' call sites are joined like any other (`tests/link/range_export`, where AWFY Permute's exported `Permute.swap` has no check; `range_export_unproven`, where one importer proves nothing and the check stays and panics). Every other build is open, and there a C, wasm or N-API host may call an exported symbol — or, under `--no-strict-exports`, any symbol — with anything (`arr_range_call_exported`, where a C host calls `pick(7)`; `range_export_header`, `_napi`, `_napi_async`, `_dts`, `_foreign`, and the IR-only, `--profile wasi` and wasm-`--target` builds `tests/run.js` makes of the same program, each of which keeps both checks). Two things fall outside the rule by definition: the `.ll` a `--link` build leaves beside its executable is that build's and is not an object to link again, and an exported function whose symbol is a C library's own name (an exported `malloc`) replaces that C function, which is outside the language. A call made where no state is kept — from an instantiation's body, from an arrow, after a `return` — is found by scanning every call in the program, not by trusting the walk, and leaves its callee entered with nothing (`arr_range_call_arrow`, `arr_range_call_generic`). **The site join.** A site is judged in the caller's state once every argument has run; a fact about an argument's local is carried only while no later argument writes it (`arr_range_call_arg_rebind`), a fact about a path read off an argument only while no later argument stores to a link of it or calls anything without a summary, and an argument of another integer type carries nothing. The entry is the join over every site: the weaker floor, the higher bound, the shorter length, a relation only where every site states it (`arr_range_call_two_sites`). Inside the callee every pass-2 invalidation applies to entry facts unchanged (`arr_range_call_rebind_callee`). **Summaries.** A callee's `CallSummary` is the field names it or anything it calls may store to and the record types it may store whole; a callee that calls a builtin handed an array or an object (`push`, `pop`), `Arena`, a foreign function or an instantiation, or stores a field named `length`, has none, and a call to it drops every array length and every path as pass 2 does (`arr_range_call_callee_pop`). A call with a summary resizes no array, so array lengths survive it, and it drops each path its stores or record types reach (`arr_range_call_rebind`); a builtin handed only numbers, booleans and strings has the empty summary, since with no mutable module state and no function value a call reaches only what it is handed. **Recursion.** A fixpoint from "not reached": each round walks the reached bodies under their current entries and rejoins every entry from the sites seen, and an entry only weakens once set, so the rounds end (`self/` in six, `arr_range_call` in nine). Past 64 rounds the pass keeps no entry fact at all. No proof is recorded until the entries settle, and a body's last walk is the one under its settled entry because a changed entry schedules another (`arr_range_call_grow` is the recursion that keeps nothing). **Narrowing, and what the pass does not walk** (#217). None of it changes a proof, and `tests/run.js` holds it to that: `--range-reference` runs the pass by the rule above with none of the following, and `range_reference` compiles `self/` and `bench/awfy`, with and without `--link`, both ways and requires every module's IR and every `--json` warning to be byte-identical (it fails when `isOpenAccess` is made to answer `false`). *Candidates.* Only a function with an access some walk could prove takes part, or one that calls such a function. `judge` proves nothing without a holder — a local array or string, or a path of plain struct links from a local — and `proves` nothing unless the index is a literal or a bare local of an integer type; `provesClamp` needs a local receiver for anything but a literal `0`, which pass 2 already folds; all of that is read off the syntax and the declared types, so an access of any other shape keeps its check in every state (`isOpenAccess`). An access inside an arrow is proved in the lifted arrow's own body, which this walk never enters. A function whose only unproven accesses are of those shapes, and a caller useful only for it, lose nothing by being entered with nothing, and the same test decides whether a body is walked after the rounds. *Joins.* A round joins again only the entries of the callees of a body it walked or of a function it forced; every other callee's sites are the objects the last round joined, in the same order. A join that is already empty stays empty, since the join with an empty site is empty. *Walks the rounds skip.* Entries only weaken, so an empty entry stays empty: a site handing facts to a callee already entered with nothing hands it an empty set without working its facts out, since they cannot change that join; a body all of whose candidate callees are already entered with nothing cannot move an entry, and is not walked for its sites; its last walk, taken under an older entry, is dropped, and its own proofs come from the walk after the rounds under the entry it settles on, by the rule that already decides that walk for a body the rounds never walked (it runs when the body has an open access and a call with a summary or an entry fact). A body with no open access proves nothing and is walked only for its sites, so its walk stops once it has noted as many as it makes calls to candidates: a call is walked at most once, so every call it would note is noted, and a call it cannot reach with a state keeps the count from being met and the walk from stopping, which is how that callee is still forced. *Pass 2* does not walk a body with no element access, `charCodeAt` or `substring` in it, which has nothing to prove and nothing to warn about. *Bookkeeping, exact by construction:* the callee of each call is looked up once, by node, instead of by name at every visit; a site collects the effects of its later arguments only when one of them can write anything (`mayWrite`); a walk hands a finished branch's state over instead of copying it; the parameters' locals are found once per body; and the summaries and the narrowing sweep the call graph callees first, which changes how soon their unions settle and not what they settle on. **Decrement.** `v -= c`, `v = v - c` and `v--` keep `v`'s upper bounds and drop its lower ones; the wrap past `INT_MIN` is ruled out by `nsw`, or under `--wrapping` only by `v >= 0` known where the subtraction runs, and an unsigned `v` never keeps one (`arr_range_call_wrap`). `--unchecked-indexing` skips the pass; `--threads` changes nothing, because a `nish/threads` body is called from an instantiation, writes nothing its caller can see and allocates only in its worker's arena, and its caller waits at the join. `self/ranges.ts`, `self/bounds.ts`, `self/visibility.ts`, guarded by `tests/run.js` on `arr_range_call`, `range_export` and `range_reference`. |

`--plain` turns all of this off (and the alignment hints) and produces the
bare Phase 1 IR, which is useful when comparing against hand-written IR. The
`tail` marker is the exception, and stays: dropping it would turn a recursion
that runs into one that overflows the stack, which is not what a flag about
decoration should do.

### Escape analysis, stack allocation, and arena scopes

`self/escape.ts` runs inside the attribute fixpoint (it needs the
`nocapture` facts of callees, and the scope facts it produces flow back up
the call graph). For every *allocation site* in a function (`new C(...)`,
an object literal, an array literal, `new Array<T>(<literal>)`) it follows
the value through parentheses, ternary arms, and the `const`-like locals it
is stored in, classifying each use with the same `classifyUse` that decides
`nocapture`:

| Flow | Meaning | Consequence |
| --- | --- | --- |
| `local` | every use consumes the value on the spot (operator operand, condition, field/element access, `.length`, `for...of` source, argument to a non-capturing parameter or a runtime builtin), and no holding local is ever reassigned | stackable sites become an entry-block `alloca` (`%Point.obj`, `%arr.hdr` + `%arr.data`), one slot per site even inside loops; non-stackable ones (dynamic `new Array<T>(n)`, strings, callee results) make the function a candidate for an arena scope |
| `returned` | returned, directly or through an alias | arena; the caller owns it and classifies it as its own site |
| `leaks` | stored into a field, element, literal, or `push`; assigned to another variable (`let q = p` included); passed to a capturing parameter; anything not modelled | arena, and the function (and every caller, transitively) gets no scope |

Soundness of the stack slot: every reference to a `local` object lives in
a local declared at or below the site's block, so nothing can name it once
the function returns, and the initializer or constructor re-runs on every
loop pass, so a reused slot never holds a stale object that is still
observable. Stack arrays are capped at `STACK_ARRAY_BYTES` (4096) of data;
`push` on one moves the elements to the arena through `nish_array_grow` and
the stack header stays valid. Every stack object is `align 8`, so the
pointer attributes above remain true for it.

A function gets an **automatic arena scope** (`%arena.mark = call i64
@nish_arena_mark()` after the allocas, `call void @nish_arena_release(i64
%arena.mark)` before every `ret`) when it has a direct arena allocation
with `local` flow, none of its sites is `returned` or `leaks`, no callee
leaks an allocation (`allocLeaks` in `FunctionFacts`), and neither it nor a
callee uses `Arena.reset` / `Arena.release` (`usesArenaControl`). Paths
that end in `unreachable` need no release. Scopes nest LIFO with the call
stack, so a mark is always released by the function that took it.

A function that allocates nothing itself earns the same bracket when its
**callees** leave memory behind and nothing can keep that memory: it is
*contained*, its return type is a number, a `boolean`, an `enum` or `void`, it
uses no `Arena.reset` / `Arena.release`, and some callee *net-allocates*
(allocates and has no scope of its own, so the bracket would reclaim
something). Contained (`FunctionFacts.contained`) means every allocation made
during the call, by the function or anything it calls, is unreachable once it
returns except through its return value, and it is proved one of two ways:

- **`!allocEscapes`**, WP9's fixpoint fact. The escape analysis follows values,
  not memory, so it counts *any* store of an allocation into memory as an
  escape, including a store into another fresh object. That is what makes it
  sound here: no pointer read back out of memory can then be one allocated
  during the call.
- **`rootsHoldNoPointer`** (`self/escape.ts`): every parameter, `this`
  included, is a scalar, a string, or an object whose every field is a
  number, a boolean or an enum. The language has no mutable global (module
  constants are scalars or strings, there are no `static` members,
  `process.argv` refuses stores), the runtime keeps no pointer it was handed,
  and no Nish pointer crosses the C boundary. So memory older than the call is
  reachable only through the parameters, and none of it has a slot a pointer
  fits in. This needs nothing from the callees, which is why
  `List.benchmark` (Are We Fast Yet) qualifies although `tail` returns an
  argument and so counts as capturing it.

Containment is deliberately not a fixpoint of its own that falls through the
callees. A callee whose parameters hold no pointers is contained however it
nests allocations inside what it returns, and a caller can read one back out
(`o.x` is not an allocation site) and store it through its own parameter;
`tests/cases/mem_callee_scope_nested` is that program. The release is sound for
the same reason as the direct scope: the scalar result names no memory,
containment covers every write, and without arena control the mark still names
the entry position. Net-allocation is profit, not proof, and is settled callees
first so that a scope does not nest around a callee that already reclaims
(`settleCalleeScopes`, `self/attributes.ts`). `tests/cases/mem_callee_scope`,
`mem_callee_scope_tree`, and the `_escape`, `_return`, `_control` and `_nested`
negatives pin it.
`--no-stack-alloc` disables the stack slots but keeps the scopes; the WP6
block of `tests/run.js` checks both modes on `mem_stack_struct` and watches
`Arena.used()` stay flat across 100000 scoped calls.

A `return g(...)` whose arguments are all scalars is emitted as a **`tail
call`**, and in a scoped function it takes the release with it — ahead of the
call rather than after it, so that the call really is the last instruction.
`marksTailCall` in `escape.ts` is the proof for both and
`tests/cases/mem_scope_tail_call_guards` holds the refusals. It needs every
argument to be a scalar (nothing the callee holds can point into this frame),
needs the signature's parameter count to match the argument list (a method's
receiver is the argument that is not written down, and it is a pointer), and,
for the release only, needs `g` not to read the bump position
(`readsArenaState`, the fixpoint fact beside `usesArenaControl`, so that
`Arena.used()` answers what it always did). Design and measurements:
[wp6-memory.md](wp6-memory.md).

A loop's **pass** gets the same bracket when nothing the pass allocates can be
reached once the pass is over except through a scalar (`decideLoopScopes`,
`self/escape.ts`, decided after `settleCalleeScopes`). The ways out of a pass
are memory older than it, a local declared outside the body, and a `return`,
and each is closed separately:

- **Memory.** No allocation site in the body `escapes`, and no callee called in
  it has `allocEscapes`. This is `contained`'s first proof restricted to the
  pass, with the same consequence: nothing allocated during the pass is stored
  anywhere, so a pointer loaded out of memory during the pass predates it. The
  one load that answers memory it did not read is an inline element (`xs[i]`
  over an interface nothing implements is the slot's address), and
  `classifyUse` and the escape flow follow such an element as the array itself
  (`yieldsInteriorPointer`); a local holding one (`const p = xs[i]`, the
  variable of a `for...of` over `xs`) is a use of `xs` too, and a harmless one
  when every reference reads or writes one of the slot's fields
  (`classifyElementHolder`), so `for (const p of ps) sum += p.x` still leaves
  `ps` `nocapture`. That also closes a hole the function scope had:
  storing `xs[i]` into a parameter's object used to count as a read of `xs`,
  so the function was contained and released the block it pointed into
  (`tests/cases/mem_loop_scope_interior`).
- **Outer locals.** An assignment in the body to a local not declared in it,
  of a type that can hold a pointer, stores only a value `isOld` proves
  predates the pass (a literal, `this`, an outer local, a field or element
  read — an inline element only when its array is old — the `const` variable
  of a nested `for...of` over an old array, a call to a function that
  allocates nothing, or a choice of two of those). A compound assignment
  to such a local is refused, and `push` is allowed only onto a `const` the
  body initialised with a fresh literal or `new Array`, because growth moves
  the data block into the arena.
- **Return.** A pointer a `return` in the body answers must be `isOld`; the
  release runs after the value is computed and before the `ret`, and a
  scalar tail call sinks it ahead of the call exactly as the function scope
  does (with the same `readsArenaState` refusal).
- **Arena control.** Neither the function nor a callee uses `Arena.reset` /
  `Arena.release`, and the function does not call `Arena.mark` itself, so the
  position read at the top of the pass is still where the pass started.

The mark is the arena's `buf` and `off`, read inline, and the release rewinds
`off` when `buf` is unchanged: `nish_arena_grow` only ever pushes a chunk in
front of the others and moves `buf` to it, so an unchanged `buf` means no chunk
of the pass survives; otherwise `nish_arena_release(buf + off)` frees the newer
chunks, the runtime's own mark. The mark dominates every release (it is the
first instruction of the body), a `break` and a `continue` release the pass of
the loop they leave (a `switch` has none), and a `return` releases only the
outermost open scope, which rewinds past every inner one. Inner scopes nest
LIFO inside outer ones and inside the function's. A `for` condition and update
run after the release and see only outer locals, which hold nothing it freed;
a `for...of` iterable is evaluated once, before the first mark. The arena is
per thread under `--threads`, and so is every mark and release.
`tests/cases/mem_loop_scope*` pin it, and their negatives read every kept value
back after the arena has been reused.

### `T | null`

The checker owns the `null` literal (typed by its contextual
`T | null`), the one-way assignability `T -> T | null` (`assignable` in
`self/types.ts`, used by initializers, returns, arguments, stores, literals,
`push`, and ternaries), and narrowing: a per-variable set of "known
non-null" bindings that a guard (`!== null` / `=== null` in `if`, `while`,
`for`, `&&`, `||`, `?:`, composed through `!` and parentheses) opens for the
region it dominates, that an early-terminating branch extends past the `if`,
and that any assignment to the variable, or a loop that assigns it, closes
(`narrow` and `clearNarrowingsAssignedIn` in `self/expressions.ts`).
Only locals and parameters narrow, never property paths. The emitter sees
no difference between `T` and `T | null` except in the attributes
(`nonnull` and `dereferenceable` are dropped, [rules above](#attribute-soundness-rules))
and in `icmp eq ... null` for the comparisons.

### `Result<T, E>`

`self/result.ts` owns the type, the three rules that make an error
impossible to ignore, and the layout every `Result` shares with the emitter;
`self/emit_result.ts` owns the lowering. The layout is *derived* from the
type rather than declared, so nothing has to be registered or kept in sync:
both sides call `resultLayout`, and an imported signature that mentions a
`Result` brings across only the layouts of its payloads.

The narrowing is the `T | null` engine: `narrow` in `self/expressions.ts`
owns the boolean algebra and the scope plumbing and recognises `p !== null`,
and hands every other condition to `narrowResultTest` in `self/result.ts`,
which recognises `r.ok` / `r.isOk()` / `r.isErr()`. The soundness argument is therefore literally the
same one — variables only, dropped on assignment, dropped before a loop that
assigns. The refinement rides on the type as `state`, which type equality
ignores because the LLVM value is the same pointer either way.

`Ok(v)` / `Err(e)` are allocation sites for WP6 like `new C(...)` is, so a
`Result` that does not outlive its function is an entry-block `alloca`;
`orReturn()` returns memory, which is what disqualifies its function from an
automatic arena scope.

A `Result` whose two payloads are each a scalar of at most four bytes
**travels in a register** (WP17), returned and passed: `resultByValue` in
`types.ts` decides, `llvmAbiType` gives the `define` and its parameters their
`i64`, and `self/emit_result.ts` packs at every `ret` and every argument and
unpacks at every call site and in the callee prologue, into an object the
receiving function owns — so nothing else in the lowering changed, and the
allocation moved to whichever side unpacks (which is why
`collectResultFacts` reports the allocator on a call, `escape.ts` records
the call as a site of *this* function, and `EscapeResult.stackParams` decides
alloca or arena for an unpacked parameter). Design, the six-target tables,
the assembly, the measurement and the one gap the packing does not close:
[wp17-result-abi.md](wp17-result-abi.md); why the in-memory representation
is still a pointer: [wp16-results.md](wp16-results.md).

### `nsw`, `--wrapping`, `--strict-exports` and `--target`

- **`nsw`** (WP9, on by default since WP15 §3): `intOpcode` in
  `self/emit_ops.ts` is the single place that decides the flag; every
  user-level **signed** integer `add`/`sub`/`mul` (including unary minus,
  `op=` on locals, fields, and elements, and `++`/`--`) becomes `add nsw` etc.,
  so signed overflow is undefined and LLVM may widen `i32` induction variables
  to 64 bits and fold `(a + 1) - 1`. Division and remainder have no `nsw`
  form, the compiler's own `i64` index, length, and allocator arithmetic is
  never flagged, and an **unsigned** type is never flagged at all — `u8`..`u64`
  are defined as wrapping, so neither `nsw` nor `nuw` is a claim the language
  makes about them. `opt_nsw.ll` is the golden that pins all three facts, and
  `opt_wrapping.ll` pins the same program with `--wrapping`, where no flag
  appears anywhere.
  The proof under the attribute is the checker's recorded type, read through
  `isUnsigned`; there is no other input to the decision.
- **Constant folding follows the same rule** (`self/constants.ts`): by
  default an initialiser that overflows its width is refused rather than
  folded, because the fold must agree with the instruction it replaces;
  `--wrapping` restores the wrap.
- **`--strict-exports`** (WP5, on by default since WP15 §3): a function without
  `export` gets `internal` linkage (`self/emit.ts`) and is left out of the
  `--emit-header` / `--emit-dts` / `--emit-napi` surface (`self/interop_abi.ts`,
  `externalFunctions`); `--no-strict-exports` puts both back. What it does
  *not* change is `rejectSymbolClashes` (`self/compilation.ts`): a function *symbol*
  is unique across the program in either mode, because `analyzeFunctions` keys
  the fact fixpoint by that symbol and two functions sharing one would be
  emitted with each other's attributes. Since WP21 S1 a symbol carries its
  module's package prefix (`self/packages.ts`), so the *name* has to be unique only
  within the package that declares it — which is what lets two dependencies
  each keep a private `helper()`. The root package's prefix is empty, so for a
  single-package program the symbol, the rule and the message are all exactly
  what they were.
- **`--target`** (WP9): `targetHeader` writes `target datalayout` and
  `target triple` after `source_filename`, from the table in
  `self/target.ts` (strings copied from `clang --target=<triple> -S
  -emit-llvm`); a mismatch with the layout clang applies at link time is a
  hard error, never a silent miscompilation. Without the flag the module is
  target-neutral and `opt`/`llc` assume a generic layout with no vector
  registers, which is why the WP1 vectorisation test needs `-mtriple` and
  the WP9 one (`opt_target_triple`) does not.
- **`noalias` on struct parameters** under an aliasing rule was considered
  for WP9 and left out: the parameters that would gain it point at objects
  LLVM already cannot tell apart, and the escape analysis above (distinct
  `alloca`s) is what recovered the benchmarks that needed provenance
  ([wp9-optimisation.md](wp9-optimisation.md)).

## Build profiles

`scripts/build.sh <modules.ll...> [more .c] -o <out> --profile <p>` wraps
the exact clang invocations; `--link` calls it with every module plus
`runtime/runtime.c`. All native profiles link `-lm` (the `Math.sin/cos/exp/log/pow`
intrinsics become libm calls for non-constant arguments).

| Profile | Flags | Equivalent |
| --- | --- | --- |
| `debug` | clang defaults, `-lm` | the "before" number; symbols kept |
| `speed` | `-O3 -flto -DNDEBUG -ffunction-sections -fdata-sections -fomit-frame-pointer -fno-asynchronous-unwind-tables -fno-unwind-tables [-fno-plt] -Wl,--gc-sections -Wl,--as-needed -Wl,-O2 -Wl,--build-id=none -s` | Rust `--release` |
| `size` | `speed` plus `-Oz -fno-stack-protector -fvisibility=hidden` | Rust `opt-level="z"`, `panic="abort"`, `strip=true` |
| `wasm` | `--target=wasm32-unknown-unknown -Oz -nostdlib -Wl,--no-entry -Wl,--export-all -Wl,--strip-all -Wl,--gc-sections` | freestanding module for modules that do not use the C runtime |
| `napi` | `speed` plus `-shared -fPIC -I<node headers> -I runtime` (`-Wl,-undefined,dynamic_lookup` on macOS) | a `.node` addon |
| `wasi` | `--target=wasm32-wasi --sysroot=<WASI sysroot> -Oz -DNDEBUG -ffunction-sections -fdata-sections -Wl,--gc-sections -Wl,--strip-all`, plus `-nodefaultlibs -lc <libclang_rt.builtins-wasm32.a>` when clang has no wasm32 compiler-rt of its own | a WASI command module (`_start` runs `main`; `node examples/wasi-host.mjs`, `wasmtime`); see [wp7-runtime.md](wp7-runtime.md#wasi-target) |

Platform notes: on macOS the script uses ld64's `-dead_strip` / `-x` instead
of `--gc-sections` / `-s`, skips `-fuse-ld=lld` and `-fno-plt`; on Linux it
prefers `lld` because GNU `ld` needs the gold plugin for LTO. `-flto`
matters more here than for C: LLVM sees the Nish module and the runtime
as one unit, so `nish_str_len` inlines into a load and unreferenced runtime
functions vanish. `CC` overrides the compiler; `NODE_INCLUDE` overrides the
Node header directory for `napi`.

Profile-guided optimisation (WP9): `--pgo-generate` adds
`-fprofile-generate` to the `speed`, `size`, and `napi` profiles and
`--pgo-use <file.profdata>` adds `-fprofile-use=<file>` (a missing file is
refused with a hint). The recipe (instrumented link, training runs with
`LLVM_PROFILE_FILE`, `llvm-profdata merge`, final link) and what it bought
on the suite are in [wp9-optimisation.md](wp9-optimisation.md); the
instrumented link needs the compiler-rt profile runtime
(`libclang-rt-18-dev` on Ubuntu).

`scripts/size-report.sh [--markdown] [module.ll] [driver.c]` prints one row
per profile; CI attaches it to every run.

## Test harness

`npm test` runs `tests/run.js`, which builds its own stage1 from the seed
(linked at `build/nish-test`), compiles every case with it, prints one
`PASS`/`FAIL` line per check (several hundred), and skips the
toolchain-dependent steps when LLVM is not installed. A run that could not do
everything it should prints a `DEGRADED:` line; an undegraded run has none, and
the skip count is the number to read, not only the exit code.

- **Golden cases** (`tests/cases/<name>.ts`): compile with the flags in
  `<name>.args`; a `<name>.err` case must fail with exit 1 and the message
  fragment; otherwise the IR (module header stripped) must equal `<name>.ll`,
  pass `llvm-as`, and, when `<name>.out` exists, be linked with
  `<name>.c` or `tests/driver.c` plus both runtime `.c` files and `-lm`, run, and
  match stdout. A source declaring `main` — `export const main`, or the legacy
  `export function main` — is linked without the driver. `node tests/run.js <substring>` runs a subset;
  `npm run test:update` writes missing goldens. The link is against the
  runtime and the driver **as object files**, built once per run instead of
  recompiled per case (470 ms a link became 91 ms), keyed on the defines the
  runtime needs — today only `-DNISH_THREADS=1`. Two `runtime objects:` checks
  hold that up: the binary linked against the objects must be byte-identical
  to the one built from the sources, and a `--threads` module must *fail* to
  link against the default objects, so a case handed the wrong runtime is a
  link error rather than a program with two arenas.
- **Diagnostics** (WP10): the caret excerpt format, syntax errors, and
  `tests/diagnostic_coverage.js`: every code in `self/codes.ts` is provoked by
  a `tests/wordings/` program or named in `tests/wordings/unreachable.txt`
  with a reason.
- **The compiler itself** (`tests/self/`): `bootstrap.js` builds the chain
  from the seed and asserts `IR(stage1) == IR(stage2)` and stage3 == stage2;
  `goldens.js` holds the type, diagnostic, symbol and checked dumps to the
  goldens in `tests/self/goldens/`; `support_oracle.js` and `reject_oracle.js`
  check the support library and the refusals; `tests/lexer_oracle.js` and
  `tests/parser_oracle.js` compare `self/`'s lexer and parser with the
  `typescript` package, which is a devDependency: the published package has
  no runtime dependency.
  `tests/nish-cmp.js` compiles the corpus with the last *released* compiler
  and with HEAD and compares the IR and the sidecars, so a change to codegen
  is visible as a diff against what users have installed.
- **Link tests** (`tests/link/<name>/`): whole programs built with `--link`,
  expected exit code and stdout, `declare`/`define` attribute agreement,
  `expected.ir` fragments (`--strict-exports`).
- **Optimisation** (WP1, WP4): `opt -O2 -mtriple=x86_64-unknown-linux-gnu`
  must vectorise `cf_sum_loop` and the unchecked `arr_sum` (`<4 x i32>`), and
  the checked sum must vectorise once inlined.
- **Layout** (WP2), **pipeline checks** (runtime unit test, alloc smoke,
  size profile, wasm profile), **interop** (WP8), **exit codes** and
  **packaging** (WP12).
- **Memory** (WP6): every `mem_*` module passes `opt -passes=verify`;
  `mem_stack_struct.ll` contains five `alloca %struct.*` objects and no
  `nish_alloc_struct` or arena prelude; the same source with
  `--no-stack-alloc` is back in the arena and prints the same output;
  `mem_scope_dynamic_array` prints identical `Arena.used()` values before
  and after 100000 scoped calls.
- **Optimisation flags** (WP9): `opt -O2` vectorises `opt_target_triple.ll`
  *without* `-mtriple`; `--target host` resolves to this machine's triple and
  an unknown triple is a usage error listing the supported ones; every
  user-level signed `i32` `add`/`sub`/`mul` in `opt_nsw.ll` carries `nsw`, no
  internal `i64` arithmetic does, and no unsigned operation does, while
  `opt_wrapping.ll` (the same program under `--wrapping`) contains no `nsw` at
  all; `bench/run.mjs --validate` builds `fib` and `sieve` at small sizes
  in every variant (speed, `--nsw`, size, C, Rust) and requires identical
  checksums (Rust is skipped without `rustc`).
- **Differential** (WP13, needs clang): `tests/differential/run.js --quick`
  compiles every whole program in `tests/cases` (those declaring `main` and
  no `.err`) and the corpus with `--link`, runs the binary, runs the same
  program's JavaScript rewrite under Node with `runtime/shim.mjs`, and
  compares stdout, exit status, and signal byte for byte. The rewrites are
  frozen in `tests/differential/goldens/rewrites.txt` — they were generated
  from the checker's recorded types (`(a + b) | 0` and `Math.imul` for
  `i32`, `BigInt.asIntN(64, ...)` for `i64`, bounds checks, byte lengths,
  saturating conversions) and there is no live rewriter any more — so a corpus
  program with no frozen rewrite is named in a register rather than skipped
  in silence. Programs listed in `tests/differential/known-failures.txt`
  (libm 1-ulp differences, `minnum`/`maxnum` with NaN, `Math.round(-0)`, the
  division panics, raw `Arena.used()` prints) are reported but do not fail.
  `tests/differential/fuzz.js --stage1` generates random integer/boolean
  programs from a printed seed, compiles each with the released compiler and
  with HEAD, and compares the IR; a failure reproduces with
  `--seed <s> --count 1` ([wp13-differential.md](wp13-differential.md)).
- **Nish harnesses**: `npm run test:nish` and `npm run test:cli` build and run
  `tests/nish/run.ts` and `tests/nish/cli.ts`, test programs written in Nish.

## Where the name lives

The project has been renamed twice, so this is a live concern rather than a
hypothetical one. The name is written out in exactly one source file,
`self/branding.ts`, and renaming it is an edit to that file rather than a
sweep over the tree:

| Constant | Holds |
| --- | --- |
| `LANGUAGE` | the language, as a diagnostic names it |
| `CLI` | the command, the word a message uses for itself |
| `BUILTIN_SCHEME`, `STD_PREFIX`, `PACKAGE_CONDITION` | the `nish:` builtin-module scheme, the standard library's import prefix, and the `package.json` condition a package resolves under |
| `RUNTIME_HEADER`, `HEADER_GUARD_PREFIX` | the `#include` and the include guard a generated header writes |
| `VERSION` | the version `--version` prints and the DWARF producer string `-g` writes. The compiler has no `package.json` to read it out of, so `tests/run.js` fails when `VERSION` and `package.json` disagree |

Every string the compiler *prints or writes* builds its name from those
constants: the Phase 0 messages, `--help`, the banner and include guard on a
generated header, the `#include` a generated header emits, the DWARF producer
string, the internal-error report.

Prose is deliberately exempt. Comments and these documents name the language
where that reads better than a constant would; what they must not do is put a
name into a string the program emits.

**`nish_` is not branding.** The prefix on every runtime C symbol
(`nish_arena`, `nish_str_concat`, `nish_main`, `NISH_SYMBOL`) is ABI: it is in
every golden `.ll`, in `runtime.c` and `nish.h`, and in every binary linked
against the runtime. The constants above are the only place a new name gets
written; the prefix is opaque, and a rename does not follow it.

It has been rewritten twice, both times as the last step of a rename and
neither time as a precedent: `sts_` — the initials of the first product name —
became `amrit_` with the AmritScript rename, and `amrit_` became `nish_` with
this one. Both were affordable for the same two reasons, and only those:
nothing has been released, so no binary anywhere links the old names, and the
~200 goldens that carry the prefix are generated (`npm run test:update`) rather
than written. Neither reason survives a first release. From there the prefix is
frozen, and a third rename stops at `LANGUAGE` and `CLI`.

## Repository layout

| Path | Contents |
| --- | --- |
| `self/` | the compiler, in Nish (see the pipeline table); `branding.ts` holds the project's name, `codes.ts` the diagnostic registry |
| `runtime/` | `runtime.c` (the core every program touches) and `runtime_os.c` (the system-call half, measured against its own ceiling), `nish.h`, `runtime_wasm.c` (freestanding arena + arrays for the wasm profile), `shim.mjs` (the Node-side runtime for the differential tests), `nish.d.ts` (the builtins' declarations `npm run check` type-checks against) |
| `bin/` | the npm package's installer: `nish` hands over to the prebuilt native compiler from the platform package `@amritk/nish-<asset>`; an unsupported platform is an error, not a fallback |
| `scripts/` | `build.sh`, `bootstrap.sh`, `fetch-seed.sh`, `size-report.sh`, `smoke.sh`, `changelog-gen.mjs`, `gen-diagnostic-codes.mjs` (frozen; `--check` only) |
| `std/` | the standard library, in Nish rather than about Nish: `testing.ts`, the `Suite` a program drives to check itself. Source is the distribution format (wp21 §2), so an import of one compiles with the program. `std/README.md` has the rules for adding a module |
| `tests/` | `run.js`, `cases/`, `link/`, `ir/`, `layout/`, `self/` (the bootstrap and the compiler's own goldens), `wordings/`, `nish/`, `nish-cmp.js`, `differential/` (`run.js`, `lib.js`, `fuzz.js`, `corpus/`, `goldens/`, `known-failures.txt`), `runtime_test.c`, `driver.c` |
| `examples/` | `add.ts`, `hello.ts`, `math.ts`, `strings.ts`, `arrays.ts` (typed arrays across the boundary), `nbody.ts`, `multi/`, `main.c`, `node-host.mjs`, `node-addon.mjs` |
| `bench/` | `run.mjs`, `README.md`, `{fib,nbody,spectral,sieve,strbuild,vec3}.{ts,c,rs}`, `strbuild_naive.c`, `rss.c`; `sum.ts` and `ffi.mjs` (the WP8 FFI benchmark) |
| `docs/` | this documentation; `docs/README.md` is the index |
| `.github/workflows/` | `ci.yml` (Ubuntu, LLVM 18; the `bootstrap` job builds stage1 from the released seed, which is what enforces the rolling freeze), `release.yml` (tag-driven tarball), `release-pr.yml`, `pr-title.yml` |
