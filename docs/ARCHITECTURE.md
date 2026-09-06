# StaticTS compiler architecture

How `statictsc` is put together: the pipeline, the side-table design that
keeps the checker and the emitter apart, the extension points for adding a
construct, the ABI contracts and the tests that guard them, the rules that
make every emitted LLVM attribute sound, and the build profiles. Read
[LANGUAGE.md](LANGUAGE.md) for what the language is and
[IR_COOKBOOK.md](IR_COOKBOOK.md) for what it compiles to.

## The pipeline

```
statictsc a.ts b.ts [-o out/] [--link exe] [--emit-header a.h ...]      src/index.ts
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
| Types | `src/types.ts` | The `StaticType` model, `llvmType`, `alignOf`, `sameType`, `resolveTypeNode` (annotation to `StaticType`), the per-file named-type resolver for classes. |
| Checker | `src/checker/index.ts` + `checker/*.ts` | Pass 1 collects signatures and struct layouts; pass 1b binds imports; pass 2 checks bodies. Every statement and expression is dispatched through a table keyed by `ts.SyntaxKind` (see below) and its type is recorded in a side table. |
| Diagnostics | `src/diagnostics.ts` | `CompileError` with the `file:line:col: error: message` summary and the caret excerpt. |
| Attributes | `src/codegen/attributes.ts` | Per-function facts (loops, memory effect, escapes, pointer-parameter facts) and the call-graph fixpoint that turns them into LLVM attributes. Runs over the whole program at once. |
| Emitter | `src/codegen/emitter.ts` + `codegen/emit/*.ts` | Lowers the checked program to IR text: module assembly, function setup, `declare`s for imports, the `@main` wrapper, the runtime prelude, and dispatch to per-construct emitters. Contains no user-facing error handling. |
| IR builder | `src/codegen/ir.ts` | `IRModule`, `IRFunction`, `IRBlock`: named blocks, hoisted allocas, SSA temp numbering (`%0` is always the first temp because every block and parameter is named), attribute-group interning. |
| Runtime ABI | `src/codegen/runtime.ts` | The `declare` lines, attributes, and memory effects of every runtime symbol and intrinsic; the IR text of the inline arena allocator; the `%struct.sts_arena` / `%struct.sts_array` layouts. |
| Runtime | `runtime/runtime.c`, `runtime/statictsc.h` | The C implementation: chunked bump arena, strings, number formatting, `Math.random`, exit, files, array growth, bounds-check panic. The header is the public C ABI. |
| Interop | `src/interop/{abi,header,dts,napi}.ts` | C header, wasm `.d.ts`, and N-API shim generators, all derived from the same checked signatures the IR was emitted from. |
| Build | `scripts/build.sh`, `size-report.sh`, `smoke.sh` | The clang/LTO profiles, the size table, the example smoke test. |
| Tests | `tests/run.js` + `tests/{cases,link,ir,layout}`, `tests/runtime_test.c`, `tests/driver.c` | Goldens, native round trips, link tests, ABI guards, interop, exit codes, packaging. |

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
| `propertyCheckers`, `methodCallCheckers`, `newCheckers`, `namespaceProperties` (`members.ts`) | the same names in `emit/members.ts` | receiver type kind (`string`, `array`, `struct`) or constructor name |
| `builtinCalls` (dotted: `console.log`, `Math.*`, `process.exit`; `strings.ts`) | `builtinCallEmitters` (`emit/strings.ts`) | dotted name |
| `builtinFunctions` (bare: `toI32`, `readFileSync`; `expressions.ts`) | `builtinFunctionEmitters` (`emit/expressions.ts`) | identifier, consulted only when no user function has that name |

Family modules: `control-flow.ts`, `strings.ts`, `math.ts`, `io.ts`,
`arrays.ts`, `classes.ts` on both sides (`checker/` and `codegen/emit/`),
plus `builtins.ts` for the shared plumbing. The array module *wraps* the
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
   `cType`/`isScalar`/`tsKeyword` in `src/interop/abi.ts`.
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
   to `runtime/runtime.c`, and to `runtime/statictsc.h`; `tests/run.js`
   fails if the three disagree. Any struct layout change touches `runtime.ts`
   and `runtime.c` in the same commit and extends a layout test. Keep
   `runtime.c` within the budget (§2 of the master plan: 8 KB source, 4 KB
   `.text` at `-Oz`; run `clang -Oz -c runtime/runtime.c && size runtime.o`).
7. **Attributes.** Tell the fact collector what the construct does:
   memory effect (`readsMemory`, callee symbols via `collectStringFacts` /
   `collectBuiltinFacts` / `factCollectors`), escapes (`classifyUse`), loop
   boundedness (`isCountedLoop`). Never add an attribute you cannot cite a
   proof for; write the reason next to the code.
8. **Tests.** A golden `tests/cases/<name>.ts` + `.ll` (`npm run test:update`
   writes a missing golden), a native round trip (`.out`, using
   `tests/driver.c`'s `test()` or an `export function main`), at least one
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
| Arena state `%struct.sts_arena = { i8* buf, i64 off, i64 cap, i8* chunks }`, bumped directly by the inlined fast path | `codegen/runtime.ts` (`ARENA_TYPE`, `inlineAllocator`), `runtime.c` (`struct sts_arena`), `statictsc.h` | **alloc smoke** (`tests/ir/alloc_smoke.ll` + `alloc_smoke_main.c`): the `--runtime-decls` prelude plus an IR function that allocates twice is linked against `runtime.c` with LTO and must observe a 16-byte bump for two 12-byte objects (`tests/run.js`, section B) |
| String `{ i64 len, i8 data[len], i8 0 }`, 8-aligned, immutable | `codegen/emit/strings.ts`, `runtime.c` (`sts_str`), `statictsc.h` | `tests/runtime_test.c` (concat, eq, formatting), every `str_*` golden and native round trip |
| Array header `%struct.sts_array = { i64 len, i64 cap, i8* data }` | `codegen/runtime.ts` (`ARRAY_TYPE`), `runtime.c`, `statictsc.h` | `tests/runtime_test.c` (`sts_array_grow`), `arr_*` native round trips, `arr_bounds_panic` (exit 1 and message) |
| Class/interface layout = clang's layout of the same C struct | `checker/classes.ts` (offsets, size, align) | **layout test** (`tests/layout/structs.ts` + `structs.c`): the runner reads each `sts_alloc_struct(i64 N)` from the IR and compares it with `_Static_assert(sizeof(struct X) == N)`; the C program is built with `-Wall -Wextra -Werror`, fills every struct through the C definition, and reads each field back through compiled getters |
| Every runtime function has a prototype in the public header | `codegen/runtime.ts`, `runtime/statictsc.h` | **header test** (`tests/run.js`, WP8 section): every name in `RUNTIME_FUNCTIONS` (minus intrinsics) plus `sts_arena` must appear in `statictsc.h`, which must compile as C11 `-pedantic` and as C++17 under `-Wall -Wextra -Werror` |
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

`runtime/runtime.c` (8.8 KB of source, about 3 KB of `.text` at `-Oz`;
budget in MASTER_PLAN.md §2: 8 KB / 4 KB, so the source budget is currently
exceeded) provides, in the order of `RUNTIME_FUNCTIONS`:

| Symbol | Purpose |
| --- | --- |
| `sts_alloc_struct(size)` | Bump allocation, 8-byte rounded and aligned, uninitialised. The compiler never calls the C version: it emits its own `alwaysinline` copy of the fast path into every module that allocates (`--runtime-decls` shows it), and only the overflow path calls `sts_arena_grow`. |
| `sts_arena_grow(size)` | Slow path (`cold noinline`): push a new chunk (at least 64 KB) and bump from it; out of memory prints `statictsc: out of memory` and exits. |
| `sts_reset_arena()` | Recycle everything in O(1): keeps the newest chunk, frees the rest, so a steady-state program stops calling `malloc` at all. |
| `sts_free_arena()` | Release all chunks; the entry wrapper calls it when `main` returns. The arena is lazy, so it can be used again afterwards. |
| `sts_str_new(bytes, len)`, `sts_str_concat`, `sts_str_eq`, `sts_str_len`, `sts_print`, `sts_str_from_i32 / i64 / f64` | Length-prefixed, NUL-terminated, immutable UTF-8 strings in the arena; `from_f64` prints exactly what JavaScript's `String(x)` prints (shortest round-trip digits). `sts_str_len` exists for C hosts; compiled code loads the header directly. |
| `sts_random()` | `Math.random`: xorshift64\*, seeded lazily from time and pid, 53 random bits in `[0, 1)`. |
| `sts_exit(code)` | `process.exit`, via libc `exit`. |
| `sts_read_file / sts_write_file / sts_append_file` | `readFileSync` / `writeFileSync` / `appendFileSync`: `open`/`pread`/`write` syscalls, the whole file in one arena string; a failure prints `statictsc: cannot read <path>` (or `cannot write`) and exits 1. |
| `sts_array_grow(hdr, elemSize)` | `push` when `len == cap`: doubles `cap` (4 from 0) and moves the elements to fresh arena storage. |
| `sts_panic_index(idx, len)` | Failed bounds check: `index out of range: <idx> >= <len>` on stderr, `_exit(1)`. |

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
%struct.sts_arena = type { i8*, i64, i64, i8* }   ; { buf, offset, capacity, chunk list }
@sts_arena = external global %struct.sts_arena, align 8
```

```asm
movq  8(%r14), %rbx      ; offset
movq  16(%r14), %rcx     ; capacity
leaq  16(%rbx), %rax     ; offset + sizeof(struct)
cmpq  %rcx, %rax
ja    .slow              ; cold: call sts_arena_grow
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
| `nounwind` | always | No exceptions exist; `throw` is `llvm.trap`. |
| `willreturn` | `loopsBounded && !hasTrap && !callsNoReturn` and every callee `willreturn` | Counted loops only (`isCountedLoop`: `for (let i = init; i CMP bound; STEP)` over `i32`, bound an identifier or non-negative literal, step toward the bound, no wrap possible, body assigns neither `i` nor `bound` and has no `throw`; `for...of` whose body cannot extend the array); `throw`, `process.exit`, and a checked `a[i]` (`sts_panic_index` is `noreturn`) clear it. Unbounded recursion is allowed by LangRef. `mustprogress` is never emitted. |
| `readnone` | effect `none` | The body touches no memory but its own allocas and calls only `readnone` callees (LLVM's own FunctionAttrs would infer it). |
| `readonly` (function) | effect `read` | The body reads memory it does not own (`.length`, field/element reads, `sts_str_eq`) and nothing writes; `throw` forces `write`. |
| `noundef` (params, returns) | always | Every StaticTS value is initialised. |
| `zeroext` | `boolean` | C ABI for `bool`. |
| `nonnull align 8` | strings, arrays, structs | No null; literals and arena objects are 8-aligned. |
| `dereferenceable(sizeof)` | struct params/returns (non-empty) | Every object comes from the arena with at least `sizeof` bytes. |
| `readonly` (string param) | always | Strings are immutable. |
| `noalias` (string param) | always | Nothing writes through a string pointer, and `noalias` only concerns modified memory. |
| `noalias` (`%this`) | constructors only | `new` hands the constructor a fresh allocation; never on other struct params (two may alias). |
| `readonly` (struct/array param) | `!writesThrough` after the fixpoint | No store through the pointer, no escape, only passed to `readonly` parameters. Array element stores through nested indexing count as writes, conservatively. |
| `nocapture` | strings: `!escaping`; pointers: `!captured` after the fixpoint | `classifyUse`: a use is harmless when consumed on the spot (operator operand, condition, `.length` receiver, template hole that concatenates, runtime builtin argument, all declared `nocapture`); it escapes when returned, stored, aliased, pushed, or passed to a capturing user function. Strings passed to a user function always escape (no fixpoint for strings). |
| runtime `declare` attributes | from `RUNTIME_FUNCTIONS` | Written next to each symbol in `runtime.ts`; intrinsics carry a subset of what LLVM itself attaches (`nounwind willreturn readnone`). |
| `alwaysinline allocsize(0)` / `cold noinline allocsize(0)` | the inline allocator / `sts_arena_grow` | The fast path must inline; the slow path must not. |

`--plain` turns all of this off (and the alignment hints) and produces the
bare Phase 1 IR, which is useful when comparing against hand-written IR.

<!-- TODO(WP9): document `--nsw` (overflow becomes UB, enables more transformations), `--target` (datalayout + triple emission), and the aliasing rule for `noalias` on struct params once WP9 lands. -->

<!-- TODO(WP6): document escape-analysed `alloca` for non-escaping `new`, arena scopes (`sts_arena_mark` / `sts_arena_release`), and `T | null` narrowing once WP6 lands. -->

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

Platform notes: on macOS the script uses ld64's `-dead_strip` / `-x` instead
of `--gc-sections` / `-s`, skips `-fuse-ld=lld` and `-fno-plt`; on Linux it
prefers `lld` because GNU `ld` needs the gold plugin for LTO. `-flto`
matters more here than for C: LLVM sees the StaticTS module and the runtime
as one unit, so `sts_str_len` inlines into a load and unreferenced runtime
functions vanish. `CC` overrides the compiler; `NODE_INCLUDE` overrides the
Node header directory for `napi`.

`scripts/size-report.sh [--markdown] [module.ll] [driver.c]` prints one row
per profile; CI attaches it to every run.

## Test harness

`npm test` builds `dist/` and runs `tests/run.js`, which prints one
`PASS`/`FAIL` line per check (466 at the time of writing) and skips the
toolchain-dependent steps when LLVM is not installed:

- **Golden cases** (`tests/cases/<name>.ts`): compile with the flags in
  `<name>.args`; a `<name>.err` case must fail with exit 1 and the message
  fragment; otherwise the IR (module header stripped) must equal `<name>.ll`,
  pass `llvm-as`, and, when `<name>.out` exists, be linked with
  `<name>.c` or `tests/driver.c` plus `runtime/runtime.c -lm`, run, and
  match stdout. A source containing `export function main` is linked without
  the driver. `node tests/run.js <substring>` runs a subset;
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

<!-- TODO(WP13): describe the differential-testing harness (StaticTS vs Node on generated programs) once WP13 lands. -->

## Repository layout

| Path | Contents |
| --- | --- |
| `src/` | the compiler (see the pipeline table) |
| `runtime/` | `runtime.c`, `statictsc.h` |
| `scripts/` | `build.sh`, `size-report.sh`, `smoke.sh`, `changelog-section.sh` |
| `tests/` | `run.js`, `cases/`, `link/`, `ir/`, `layout/`, `runtime_test.c`, `driver.c` |
| `examples/` | `add.ts`, `hello.ts`, `math.ts`, `strings.ts`, `multi/`, `main.c`, `node-host.mjs`, `node-addon.mjs` |
| `bench/` | `fib.ts`/`fib.c`, `sum.ts`, `ffi.mjs` |
| `docs/` | this documentation; `docs/README.md` is the index |
| `.github/workflows/` | `ci.yml` (Ubuntu + macOS, LLVM 18), `release.yml` (tag-driven tarball) |
