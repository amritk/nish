# Nish compiler architecture

How `nish` is put together: the pipeline, the side-table design that
keeps the checker and the emitter apart, the extension points for adding a
construct, the ABI contracts and the tests that guard them, the rules that
make every emitted LLVM attribute sound, and the build profiles. Read
[LANGUAGE.md](LANGUAGE.md) for what the language is and
[IR_COOKBOOK.md](IR_COOKBOOK.md) for what it compiles to.

## The pipeline

```
nish a.ts b.ts [-o out/] [--link exe] [--emit-header a.h ...]      src/index.ts
   │
   ▼
Compilation                                                            src/compilation.ts
   ├─ load (per module, transitively through imports; each file once)
   │    ├─ Phase A  parse        ts.createSourceFile                    src/parser.ts
   │    ├─ Phase 0  validate     forbidden-syntax sweep, hard fail      src/validator.ts
   │    └─ Phase B1 signatures   functions, classes, interfaces, imports src/checker/index.ts
   ├─ check
   │    ├─ Phase B1b bind imports to the exporters' signatures
   │    ├─ reject external-symbol clashes across modules
   │    └─ Phase B2 bodies       statements/expressions via dispatch tables
   ├─ emit
   │    ├─ Phase C0 attributes   program-wide purity/escape/loop fixpoint src/codegen/attributes.ts
   │    └─ Phase C1 IR text      one module per source file             src/codegen/emitter.ts
   └─ interop sidecars           --emit-header / --emit-dts / --emit-napi src/interop/
   │
   ▼
.ll files ──▶ scripts/build.sh + runtime/runtime.c ──▶ native binary / .wasm / .node
```

| Stage | File(s) | Responsibility |
| --- | --- | --- |
| CLI | `src/index.ts` | Flag parsing, output planning (`-o file.ll`, `-o dir/`, `--link exe` intermediates), the toolchain probe, exit codes (0 ok, 1 compile error, 2 usage, 3 toolchain, 70 internal), the internal-error report. |
| Compilation | `src/compilation.ts` | Owns every `ModuleUnit` of one program: loads roots and imports (keyed by absolute path, so cycles terminate), runs the checker passes in the right order, rejects symbol clashes, runs the attribute analysis over all modules, emits one `.ll` per module, and computes output stems. |
| Parser | `src/parser.ts` | Wraps `ts.createSourceFile` with `setParentNodes`; turns TypeScript syntax diagnostics into `StaticSyntaxError`. |
| Validator | `src/validator.ts` | One pre-order `ts.forEachChild` walk, dispatched by `ts.SyntaxKind` through the `validators` table; decides everything from syntax alone (no types, no scopes); throws on the first forbidden construct. Defence in depth: it sees nodes the checker never visits. |
| Types | `src/types.ts` | The `StaticType` model, `llvmType`, `alignOf`, `sameType`, `resolveTypeNode` (annotation to `StaticType`), the per-file named-type resolver for classes, and the mangling that gives each `Result<T, E>` its monomorphised struct name. |
| Checker | `src/checker/index.ts` + `checker/*.ts` | Pass 1 collects signatures and struct layouts; pass 1b binds imports; pass 2 checks bodies. Every statement and expression is dispatched through a table keyed by `ts.SyntaxKind` (see below) and its type is recorded in a side table. |
| Diagnostics | `src/diagnostics.ts` | `CompileError` with the `file:line:col: error: message` summary and the caret excerpt. |
| Attributes | `src/codegen/attributes.ts` | Per-function facts (loops, memory effect, escapes, pointer-parameter facts, allocation facts) and the call-graph fixpoint that turns them into LLVM attributes, arena scopes, and stack slots. Runs over the whole program at once. |
| Escape analysis | `src/codegen/escape.ts` | Per allocation site (`new`, object literal, array literal, `new Array<T>(<literal>)`, `Ok(v)` / `Err(e)`): does the value stay `local`, is it `returned`, or does it `leak`? Decides stack allocation and feeds the arena-scope facts (WP6). |
| Target | `src/codegen/target.ts` | The `--target` table: canonical triples, their aliases, `host` resolution from `process.platform`/`arch`, and the clang 18 data-layout string written into the module header (WP9). |
| Emitter | `src/codegen/emitter.ts` + `codegen/emit/*.ts` | Lowers the checked program to IR text: module assembly, function setup, `declare`s for imports, the `@main` wrapper, the runtime prelude, and dispatch to per-construct emitters. Contains no user-facing error handling. |
| IR builder | `src/codegen/ir.ts` | `IRModule`, `IRFunction`, `IRBlock`: named blocks, hoisted allocas, SSA temp numbering (`%0` is always the first temp because every block and parameter is named), attribute-group interning. |
| Runtime ABI | `src/codegen/runtime.ts` | The `declare` lines, attributes, and memory effects of every runtime symbol and intrinsic; the IR text of the inline arena allocator; the `%struct.nish_arena` / `%struct.nish_array` layouts. |
| Runtime | `runtime/runtime.c`, `runtime/nish.h`, `runtime/runtime_wasm.c` | The C implementation: chunked bump arena with marks (`nish_arena_mark` / `release` / `used`), strings, number formatting, `Math.random`, exit, files, array growth and `nish_alloc_array` (the host entry the wasm loader uses), the bounds-check and division panics. The header is the public C ABI. `runtime_wasm.c` is the freestanding subset (arena over linear memory, arrays, trapping panics) for the wasm profile. `runtime/shim.mjs` is the Node-side twin used by the differential tests. |
| Interop | `src/interop/{abi,header,dts,napi}.ts` | C header, wasm `.d.ts`, and N-API shim generators, all derived from the same checked signatures the IR was emitted from. |
| Build | `scripts/build.sh`, `size-report.sh`, `smoke.sh` | The clang/LTO profiles, the size table, the example smoke test. |
| Tests | `tests/run.js` + `tests/{cases,link,ir,layout}`, `tests/runtime_test.c`, `tests/driver.c` | Goldens, native round trips, link tests, ABI guards, memory checks, interop, exit codes, packaging, benchmark checksums. |
| Differential tests | `tests/differential/{run,lib,rewrite,fuzz}.js`, `tests/differential/corpus/`, `runtime/shim.mjs` | Every whole program compiled natively and rewritten to JavaScript from the checker's own types, run under Node, and compared byte for byte; a seeded random-program fuzzer (WP13). |
| Bench | `bench/run.mjs`, `bench/*.{ts,c,rs}`, `bench/rss.c`, `bench/ffi.mjs` | The Nish / C / Rust suite that writes `docs/BENCHMARKS.md` (WP9), and the interop batching benchmark (WP8). |

## Side tables: the checker records, the emitter reads

The checker never rewrites the AST and the emitter never re-derives a type.
Everything the emitter needs is written into `CheckedProgram`
(`src/checker/program.ts`), keyed by AST node in `WeakMap`s so that no node
is ever mutated:

| Table | Key | Value | Who writes | Who reads |
| --- | --- | --- | --- | --- |
| `types` | any expression node | its `StaticType` | every expression checker | `ctx.typeOf` in every emitter |
| `bindings` | identifier node | the `LocalVar` it refers to (`param` or `local` storage) | identifier/assignment checkers | `emitIdentifier` (SSA value vs. `load` from a slot), escape analysis |
| `locals` | `VariableDeclaration` node | the `LocalVar` it introduces | `checkVariableDeclarationList` | alloca emission, counted-loop analysis |
| `callees` | `CallExpression` node | the `FunctionSig` called (free functions and methods) | call checkers | call emission, call-graph facts |
| `structs` | class/interface name | `StructInfo`: fields with index/offset, size, align, methods, ctor | pass 1 | GEP indices, `sizeof`, `dereferenceable` |
| `coercions` | expression node | `{ from, to }` for a class used as an interface it implements | contextual-type check | one `bitcast` at the use site |
| `functions`, `imports`, `exports`, `entryMain` | – | signatures in source order, import bindings, exported names, the entry `main` | pass 1 / 1b | function emission, `declare`s, the `@main` wrapper |

Consequences:

- The emitter can assume every node it sees is valid, so `emit/*.ts` has no
  diagnostics at all; an unexpected node there is an internal error (exit
  70), never a user error.
- Whole-program facts live *outside* the AST: `analyzeFunctions` returns a
  `Map<symbol, FunctionFacts>` over every module, and the emitter of each
  module reads the same map, which is why an importer's `declare` carries
  exactly the exporter's attributes (`tests/link/*` check this attribute for
  attribute).
- A `Checker` can also run stand-alone on one module (`check()`), which is
  what unit-style tests and `--runtime-decls` prelude generation use.

### Dispatch tables

Both phases are tables keyed by `ts.SyntaxKind` (or by operator token, or by
receiver type kind), populated by construct-family modules that are spread
into the core tables at load time:

| Checker table (`src/checker/`) | Emitter mirror (`src/codegen/emit/`) | Keyed by |
| --- | --- | --- |
| `statementCheckers` (`statements.ts`) | `statementEmitters` (`statements.ts`) | statement `SyntaxKind` |
| `expressionCheckers` (`expressions.ts`) | `expressionEmitters` (`expressions.ts`) | expression `SyntaxKind` |
| `binaryCheckers`, `unaryCheckers` | `binaryEmitters`, `unaryEmitters` | operator token |
| `assignmentTargetCheckers` (`members.ts`) | `assignmentTargetEmitters` (`members.ts`) | kind of the assignment *target* (`p.x = v`, `a[i] = v`) |
| `propertyCheckers`, `methodCallCheckers`, `newCheckers`, `namespaceProperties` (`members.ts`) | the same names in `emit/members.ts` | receiver type kind (`string`, `array`, `struct`, `result`) or constructor name |
| `builtinCalls` (dotted: `console.log`, `Math.*`, `process.exit`; `strings.ts`) | `builtinCallEmitters` (`emit/strings.ts`) | dotted name |
| `builtinFunctions` (bare: `toI32`, `readFileSync`; `expressions.ts`) | `builtinFunctionEmitters` (`emit/expressions.ts`) | identifier, consulted only when no user function has that name |

Family modules: `control-flow.ts`, `strings.ts`, `math.ts`, `io.ts`,
`arrays.ts`, `classes.ts`, `arena.ts` (the `Arena.*` builtins) on both sides
(`checker/` and `codegen/emit/`), `result.ts` on both sides (WP16),
`checker/nullable.ts` (the `null` literal, `T | null` assignability),
`checker/narrowing.ts` (the flow engine `nullable.ts` and `result.ts` both
register a rule with) and `emit/arithmetic.ts` (integer
operators with the checked `sdiv`/`srem`, shared by binary operators and
every `op=` form) on one side, plus `builtins.ts` for the shared plumbing. The array module *wraps* the
existing `=`/`op=` handlers (`installArrayAssignmentCheckers`) instead of
replacing them, so element targets and property targets compose in either
registration order.

## How to add a construct

The checklist every work package has followed (MASTER_PLAN.md §7):

1. **Decide the rule and the lowering first.** Write the TypeScript snippet
   and the IR you expect by hand; check it with `llvm-as` and
   `opt -passes=verify`.
2. **Validator.** If the construct can *never* be compiled, add a rule to
   `validators` in `src/validator.ts` and a `tests/cases/reject_<x>.ts` +
   `.err`. If it is merely unsupported today, leave the validator alone: the
   checker's `Unsupported ... in Phase 1` fallback covers it.
3. **Types.** New type? Extend `StaticType`, `llvmType`, `alignOf`,
   `sameType`, `typeToString`, `resolveTypeNode` in `src/types.ts`, and
   `cType`/`isScalar`/`tsKeyword` in `src/interop/abi.ts`. A numeric type
   also touches `isNumeric` plus `isInteger` (and `isUnsigned`/`intBits` for
   an integer width) or `isFloat` (and `floatConstant` in
   `codegen/emit/builtins.ts` for the constant encoding), `wasmType` in
   `interop/dts.ts`, `crossesWasm` in `interop/wasm.ts`,
   `SCALAR_READERS`/`scalarBox` in `interop/napi.ts`, and
   `BASIC_TYPES`/`bitsOf` in `codegen/debug.ts`. The two N-API tables are the
   ones to remember: a type with no row there does not make the shim refuse a
   signature that mentions it, it makes the shim leave that function out of
   the addon, which is how `u8`, `u16`, `u32`, `u64` and `f32` were unbridged
   for as long as they were.
4. **Checker.** Write a handler in the matching family module (or a new
   one), register it in the table, record every type/binding the emitter
   will need in `CheckedProgram`, and give every rejection a message that
   names the construct. Termination-affecting statements return `true` from
   their `StatementChecker` when they cannot fall through.
5. **Emitter.** Mirror the handler in `src/codegen/emit/`; read only the
   side tables; name every new basic block (`ctx.fn.block("kind.role")`);
   hoist allocas with `emitAlloca`; reference runtime symbols only through
   `ctx.useRuntime(name)` so the declaration is emitted.
6. **Runtime.** New C symbol? Add it to `RUNTIME_FUNCTIONS` in
   `src/codegen/runtime.ts` (signature, attributes, `effect`, `noreturn`),
   to `runtime/runtime.c`, and to `runtime/nish.h`; `tests/run.js`
   fails if the three disagree. Any struct layout change touches `runtime.ts`
   and `runtime.c` in the same commit and extends a layout test. Keep
   `runtime.c` within the budget — every `.text*` section summed, under 4,864
   bytes at `-Oz` (§2 of the master plan, and
   [wp7-runtime.md](wp7-runtime.md) for each measurement and why the ceiling
   moved). `node tests/run.js budget` measures it, so this is a check you can
   run rather than a number to remember; `clang -Oz -c runtime/runtime.c &&
   size -A runtime.o` is the same measurement by hand.
7. **Attributes.** Tell the fact collector what the construct does:
   memory effect (`readsMemory`, callee symbols via `collectStringFacts` /
   `collectBuiltinFacts` / `factCollectors`), escapes (`classifyUse`), loop
   boundedness (`isCountedLoop`). Never add an attribute you cannot cite a
   proof for; write the reason next to the code.
8. **Tests.** A golden `tests/cases/<name>.ts` + `.ll` (`npm run test:update`
   writes a missing golden), a native round trip (`.out`, using
   `tests/driver.c`'s `test()` or an `export const main`), at least one
   `reject_*` case, and `.args` for flags.
9. **Docs.** Add the rule to [LANGUAGE.md](LANGUAGE.md) with the test-case
   citation, a snippet to `docs/cookbook/` with a marker in
   [IR_COOKBOOK.md](IR_COOKBOOK.md), run `docs/cookbook/regen.sh`, and add a
   line to `CHANGELOG.md`.

## ABI contracts and the tests that guard them

Everything shared between the IR the compiler emits, the C runtime, and a
host is a contract that a test enforces:

| Contract | Defined in | Guarded by |
| --- | --- | --- |
| Arena state `%struct.nish_arena = { i8* buf, i64 off, i64 cap, i8* chunks }`, bumped directly by the inlined fast path. `off` and `cap` are `uint64_t` on the C side, never `size_t`: the IR says `i64` on every target, and under wasm32 a `size_t` pair would sit at bytes 4 and 8 instead of 8 and 16 | `codegen/runtime.ts` (`ARENA_TYPE`, `inlineAllocator`), `runtime.c` (`struct nish_arena`), `runtime_wasm.c`, `nish.h` | **alloc smoke** (`tests/ir/alloc_smoke.ll` + `alloc_smoke_main.c`): the `--runtime-decls` prelude plus an IR function that allocates twice is linked against `runtime.c` with LTO and must observe a 16-byte bump for two 12-byte objects (`tests/run.js`, section B). The offsets themselves are `_Static_assert`ed in both runtimes and, per target, in the header layout check that compiles `nish.h` for the host and for wasm32 |
| String `{ i64 len, i8 data[len], i8 0 }`, 8-aligned, immutable | `codegen/emit/strings.ts`, `runtime.c` (`nish_str`), `nish.h` | `tests/runtime_test.c` (concat, eq, formatting), every `str_*` golden and native round trip |
| Array header `%struct.nish_array = { i64 len, i64 cap, i8* data }` | `codegen/runtime.ts` (`ARRAY_TYPE`), `runtime.c`, `runtime_wasm.c`, `nish.h`, `interop/wasm.ts` (offsets 0 / 16 on wasm32) | `tests/runtime_test.c` (`nish_array_grow`, `nish_alloc_array`), `arr_*` native round trips, `arr_bounds_panic` (exit 1 and message), the WP4/WP8 block of `tests/run.js` (a C driver's stack-built header, the wasm loader and the N-API addon agreeing on `examples/arrays.ts`) |
| Class/interface layout = clang's layout of the same C struct | `checker/classes.ts` (offsets, size, align) | **layout test** (`tests/layout/structs.ts` + `structs.c`): the runner reads each `nish_alloc_struct(i64 N)` from the IR and compares it with `_Static_assert(sizeof(struct X) == N)`; the C program is built with `-Wall -Wextra -Werror`, fills every struct through the C definition, and reads each field back through compiled getters |
| Every runtime function has a prototype in the public header | `codegen/runtime.ts`, `runtime/nish.h` | **header test** (`tests/run.js`, WP8 section): every name in `RUNTIME_FUNCTIONS` (minus intrinsics) plus `nish_arena` must appear in `nish.h`, which must compile as C11 `-pedantic` and as C++17 under `-Wall -Wextra -Werror` |
| Generated C header matches the IR's signatures | `interop/header.ts` | `add.h` content check; a C driver compiled against it with `-Werror` and run |
| Generated `.d.ts` is valid TypeScript | `interop/dts.ts` | `tsc` over the generated file |
| N-API shim and wasm build agree | `interop/napi.ts`, `build.sh --profile napi/wasm` | addon build, load, type-check errors, `.node` vs `.wasm` results |
| Importer `declare` = exporter `define` attributes | `attributes.ts`, `emitter.ts` | every `tests/link/*` positive test compares the attribute sets across modules |
| Entry wrapper and exit codes | `emitter.ts` (`emitEntryWrapper`), `index.ts` | `entry_main*` goldens, `tests/link/*` expected exit codes, the WP12 exit-code block (ICE hook, missing toolchain, failing `build.sh`) |
| C ABI of scalars (`int32_t`, `double`, `bool` zero-extended) | `interop/abi.ts` | `examples/main.c` driver in the size-profile check, `tests/driver.c` in every `.out` case |
| Package contents (`dist/`, `runtime/`, `scripts/`, `LICENSE`, `docs/INSTALL.md`) | `package.json#files` | the WP12 package block: `npm pack`, install into a temp prefix, link a hello-world from another directory |

The rule behind the table (MASTER_PLAN.md §2): any change to a struct layout
touches `runtime.ts` and `runtime.c` in the same commit and adds or extends
a layout smoke test.

### Runtime symbols

`runtime/runtime.c` (4,670 bytes of `.text*` at `-Oz` against the
MASTER_PLAN.md §2 budget of 4,864, plus 9,920 bytes of `.rodata` that is almost
all Ryu's two power-of-five tables; measure with
`clang -Oz -c runtime/runtime.c && size -A runtime.o`, or
`scripts/size-report.sh`, which reports both rows) provides, in the order
of `RUNTIME_FUNCTIONS`:

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

`src/codegen/attributes.ts` emits an LLVM attribute only when the checker's
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
| `willreturn` | `loopsBounded && !hasTrap && !callsNoReturn` and every callee `willreturn` | Counted loops only (`isCountedLoop`: `for (let i = init; i CMP bound; STEP)` over `i32`, bound an identifier or non-negative literal, step toward the bound, no wrap possible, body assigns neither `i` nor `bound`; `for...of` whose body cannot extend the array); `process.exit`, `panic`, a checked `a[i]` (`nish_panic_index` is `noreturn`), and an integer `/` or `%` (`nish_panic_div`) clear it. Unbounded recursion is allowed by LangRef. `mustprogress` is never emitted. |
| `readnone` | effect `none` | The body touches no memory but its own allocas and calls only `readnone` callees (LLVM's own FunctionAttrs would infer it). |
| `readonly` (function) | effect `read` | The body reads memory it does not own (`.length`, field/element reads, a `Result` payload, `nish_str_eq`) and nothing writes; building a `Result`, a checked `a[i]`, and an integer division force `write` (the allocator and the panic callees are `write`). Field access through a local that only ever holds a stack object (`stackLocals`) is the function's own memory and counts as neither (WP6). |
| `noundef` (params, returns) | every shape but one | Every Nish value is initialised. The exception is a by-value `Result` under the private ABI (WP15 §7b): the arm that is not live is `undef` by construction, and `noundef` on an aggregate is about every element of it, so that shape carries none. |
| `zeroext` | `boolean` | C ABI for `bool`. |
| `nonnull align 8` | non-nullable strings, arrays, structs | No null value in those types; literals, arena objects, and stack objects are 8-aligned. A `T \| null` parameter or return keeps `align 8` (null is aligned) and loses `nonnull` and `dereferenceable` (WP6). |
| `dereferenceable(sizeof)` / `dereferenceable(24)` | non-nullable struct params/returns (non-empty) / non-nullable array params and returns | Every object comes from the arena or a stack slot with at least `sizeof` bytes; every array value comes from a literal, `new Array`, or a function that returned one, all of which write the full 24-byte header (WP9). |
| `readonly` (string param) | always | Strings are immutable. |
| `!tbaa` (class field load/store) | the struct is a class that implements no interface | Struct-path TBAA: a field is named by its class, its LLVM type and its byte offset, so a store to one field cannot be a load of another whatever the two pointers are. Sound because Nish has no inheritance, no casts, no unions and no pointer arithmetic, so a `%struct.C*` is the only type through which a `C` object's bytes are read or written. `implements` is the exception — it lays an interface's fields out first so `%struct.C*` may be `bitcast` to `%struct.I*`, real prefix subtyping — and those accesses carry no tag at all. Worth 87.5M instructions to 80.0M on `bench/nbody` (`src/codegen/emit/tbaa.ts`). |
| `noalias` (string param) | always | Nothing writes through a string pointer, and `noalias` only concerns modified memory. |
| `noalias` (`%this`) | constructors only | `new` hands the constructor a fresh allocation; never on other struct params (two may alias). |
| `readonly` (struct/array param) | `!writesThrough` after the fixpoint | No store through the pointer, no escape, only passed to `readonly` parameters. Array element stores through nested indexing count as writes, conservatively. |
| `nocapture` | strings: `!escaping`; pointers: `!captured` after the fixpoint | `classifyUse`: a use is harmless when consumed on the spot (operator operand, condition, `.length` receiver, template hole that concatenates, runtime builtin argument, all declared `nocapture`); it escapes when returned, stored, aliased, pushed, or passed to a capturing user function. Strings passed to a user function always escape (no fixpoint for strings). |
| runtime `declare` attributes | from `RUNTIME_FUNCTIONS` | Written next to each symbol in `runtime.ts`; intrinsics carry a subset of what LLVM itself attaches (`nounwind willreturn readnone`). |
| `alwaysinline allocsize(0)` / `cold noinline allocsize(0)` | the inline allocator / `nish_arena_grow` | The fast path must inline; the slow path must not. |
| `!alias.scope` / `!noalias` (array accesses) | every load and store of an `nish_array` header field, and every load and store of element data | The header's three fields and the `cap * sizeof(T)` of element storage never overlap, in any of the four shapes the compiler produces them: two arena bumps, two entry-block allocas (WP6), the `nish_alloc_array` host entry (two bumps again), and `nish_argv_init`'s single `malloc` block whose elements begin *after* the header. So an element store cannot reach a header field, nor the reverse. Strings are excluded — one block, length and bytes contiguous. Struct fields were excluded too, for want of a measurement; they have one now and carry `!tbaa` instead, above. WP15 §2b; the argument is written out in `emit/arrays.ts`. |

`--plain` turns all of this off (and the alignment hints) and produces the
bare Phase 1 IR, which is useful when comparing against hand-written IR.

### Escape analysis, stack allocation, and arena scopes

`src/codegen/escape.ts` runs inside the attribute fixpoint (it needs the
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
`--no-stack-alloc` disables the stack slots but keeps the scopes; the WP6
block of `tests/run.js` checks both modes on `mem_stack_struct` and watches
`Arena.used()` stay flat across 100000 scoped calls. Design and measurements:
[wp6-memory.md](wp6-memory.md).

### `T | null`

`checker/nullable.ts` owns the `null` literal (typed by its contextual
`T | null`), the one-way assignability `T -> T | null` (`assignable` in
`types.ts`, used by initializers, returns, arguments, stores, literals,
`push`, and ternaries), and narrowing: a per-variable set of "known
non-null" bindings that a guard (`!== null` / `=== null` in `if`, `while`,
`for`, `&&`, `||`, `?:`, composed through `!` and parentheses) opens for the
region it dominates, that an early-terminating branch extends past the `if`,
and that any assignment to the variable, or a loop that assigns it, closes.
Only locals and parameters narrow, never property paths. The emitter sees
no difference between `T` and `T | null` except in the attributes
(`nonnull` and `dereferenceable` are dropped, [rules above](#attribute-soundness-rules))
and in `icmp eq ... null` for the comparisons.

### `Result<T, E>`

`checker/result.ts` owns the type, the three rules that make an error
impossible to ignore, and the layout every `Result` shares with the emitter;
`codegen/emit/result.ts` owns the lowering. The layout is *derived* from the
type rather than declared, so nothing has to be registered or kept in sync:
both sides call `resultLayout`, and an imported signature that mentions a
`Result` brings across only the layouts of its payloads.

The narrowing is the `T | null` engine, extracted into
`checker/narrowing.ts` and given a registry: `nullable.ts` contributes the
rule that recognises `p !== null`, `result.ts` the one that recognises
`r.ok` / `r.isOk()` / `r.isErr()`, and the engine owns the boolean algebra
and the scope plumbing. The soundness argument is therefore literally the
same one — variables only, dropped on assignment, dropped before a loop that
assigns. The refinement rides on the type as `state`, which `sameType`
ignores because the LLVM value is the same pointer either way.

`Ok(v)` / `Err(e)` are allocation sites for WP6 like `new C(...)` is, so a
`Result` that does not outlive its function is an entry-block `alloca`;
`orReturn()` returns memory, which is what disqualifies its function from an
automatic arena scope.

A `Result` whose two payloads are each a scalar of at most four bytes
**travels in a register** (WP17), returned and passed: `resultByValue` in
`types.ts` decides, `llvmAbiType` gives the `define` and its parameters their
`i64`, and `emit/result.ts` packs at every `ret` and every argument and
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
  `emit/context.ts` is the single place that decides the flag; every
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
- **Constant folding follows the same rule** (`checker/constants.ts`): by
  default an initialiser that overflows its width is refused rather than
  folded, because the fold must agree with the instruction it replaces;
  `--wrapping` restores the wrap.
- **`--strict-exports`** (WP5, on by default since WP15 §3): a function without
  `export` gets `internal` linkage (`emitter.ts`) and is left out of the
  `--emit-header` / `--emit-dts` / `--emit-napi` surface (`interop/abi.ts`,
  `externalFunctions`); `--no-strict-exports` puts both back. What it does
  *not* change is `rejectSymbolClashes` (`compilation.ts`): a function name is
  unique across the program in either mode, because `analyzeFunctions` keys the
  fact fixpoint by symbol name and two functions sharing one would be emitted
  with each other's attributes.
- **`--target`** (WP9): `targetHeader` writes `target datalayout` and
  `target triple` after `source_filename`, from the table in
  `codegen/target.ts` (strings copied from `clang --target=<triple> -S
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

`npm test` builds `dist/` and runs `tests/run.js`, which prints one
`PASS`/`FAIL` line per check (several hundred) and skips the
toolchain-dependent steps when LLVM is not installed:

- **Golden cases** (`tests/cases/<name>.ts`): compile with the flags in
  `<name>.args`; a `<name>.err` case must fail with exit 1 and the message
  fragment; otherwise the IR (module header stripped) must equal `<name>.ll`,
  pass `llvm-as`, and, when `<name>.out` exists, be linked with
  `<name>.c` or `tests/driver.c` plus `runtime/runtime.c -lm`, run, and
  match stdout. A source declaring `main` — `export const main`, or the legacy
  `export function main` — is linked without the driver. `node tests/run.js <substring>` runs a subset;
  `npm run test:update` writes missing goldens.
- **Diagnostics** (WP10): the caret excerpt format, syntax errors.
- **Link tests** (`tests/link/<name>/`): whole programs built with `--link`,
  expected exit code and stdout, `declare`/`define` attribute agreement,
  `expected.ir` fragments (`--strict-exports`).
- **Optimisation** (WP1, WP4): `opt -O2 -mtriple=x86_64-unknown-linux-gnu`
  must vectorise `cf_sum_loop` and the unchecked `arr_sum` (`<4 x i32>`), and
  the checked sum must vectorise once inlined.
- **Layout** (WP2), **pipeline checks** (runtime unit test, alloc smoke,
  size profile, wasm profile), **interop** (WP8), **validator** timing
  (under 50 ms on a synthetic 1,000-line file), **exit codes** and
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
  no `.err`) and the 50-program corpus with
  `--link`, runs the binary, rewrites the same program to JavaScript with
  `tests/differential/rewrite.js` (the checker's recorded types choose the
  rewrite: `(a + b) | 0` and `Math.imul` for `i32`, `BigInt.asIntN(64, ...)`
  for `i64`, `__nish.idx` for bounds checks, byte lengths, saturating
  conversions), runs it under Node with `runtime/shim.mjs`, and compares
  stdout, exit status, and signal byte for byte. Programs listed in
  `tests/differential/known-failures.txt` (libm 1-ulp differences,
  `minnum`/`maxnum` with NaN, `Math.round(-0)`, the division panics, raw
  `Arena.used()` prints) are reported but do not fail. A second check runs
  `tests/differential/fuzz.js` on 10 random integer/boolean programs with a
  fixed seed; the seed is printed so a failure reproduces with
  `--seed <s> --count 1`. `npm run test:diff` runs the full set and
  `node tests/differential/fuzz.js --count 200` a larger batch
  ([wp13-differential.md](wp13-differential.md)).

## Where the name lives

The project has been renamed twice, so this is a live concern rather than a
hypothetical one. The name is written out in exactly two source files, and
renaming it is an edit to those two rather than a sweep over the tree:

| File | Holds |
| --- | --- |
| `src/branding.ts` | `LANGUAGE` (the language, as a diagnostic names it), `CLI` (the npm package, the `bin` entry, the word a message uses for itself), and the names derived from `CLI`: `ENV_DEBUG`, `ENV_SIMULATE_ICE`, `RUNTIME_HEADER`, `HEADER_GUARD_PREFIX` |
| `self/branding.ts` | `LANGUAGE`, plus `CLI` and `VERSION` for the DWARF producer string `-g` writes — stage1's driver still calls itself `compile`, and it has no `package.json` to read the version out of, so `tests/run.js` fails when `VERSION` and `package.json` disagree |

Every string the compiler *prints or writes* builds its name from those
constants: the Phase 0 messages, `--help`, the banner and include guard on a
generated header, the `#include` a generated header emits, the DWARF producer
string, the internal-error report. The two files must agree on `LANGUAGE`,
because `tests/self/reject_oracle.js` compares the two compilers' messages byte
for byte, and on `CLI` and the version, because `tests/self/ir_oracle.js`
compares the `-g` metadata the same way.

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
| `src/` | the compiler (see the pipeline table); `branding.ts` holds the project's name |
| `runtime/` | `runtime.c`, `nish.h`, `runtime_wasm.c` (freestanding arena + arrays for the wasm profile), `shim.mjs` (the Node-side runtime for the differential tests) |
| `scripts/` | `build.sh`, `size-report.sh`, `smoke.sh`, `changelog-section.sh` |
| `std/` | the standard library, in Nish rather than about Nish: `testing.ts`, the `Suite` a program drives to check itself. Source is the distribution format (wp21 §2), so an import of one compiles with the program. `std/README.md` has the rules for adding a module |
| `tests/` | `run.js`, `cases/`, `link/`, `ir/`, `layout/`, `differential/` (`run.js`, `lib.js`, `rewrite.js`, `fuzz.js`, `corpus/`, `known-failures.txt`), `runtime_test.c`, `driver.c` |
| `examples/` | `add.ts`, `hello.ts`, `math.ts`, `strings.ts`, `arrays.ts` (typed arrays across the boundary), `nbody.ts`, `multi/`, `main.c`, `node-host.mjs`, `node-addon.mjs` |
| `bench/` | `run.mjs`, `README.md`, `{fib,nbody,spectral,sieve,strbuild,vec3}.{ts,c,rs}`, `strbuild_naive.c`, `rss.c`; `sum.ts` and `ffi.mjs` (the WP8 FFI benchmark) |
| `docs/` | this documentation; `docs/README.md` is the index |
| `.github/workflows/` | `ci.yml` (Ubuntu + macOS, LLVM 18), `release.yml` (tag-driven tarball) |
