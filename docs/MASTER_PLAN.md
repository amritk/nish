# Nish Master Plan

The single source of truth for what Nish is, what exists, what remains,
and how the remaining work is cut into packages that independent agents can
build in parallel. Every work package (WP) below is self-contained: goal,
scope, files, dependencies, acceptance tests, and a ready-to-use agent brief.

Repo: `amritk/nish`, default branch `main`.

---

## 1. Vision

Nish is an ahead-of-time compiler for a strictly static subset of
TypeScript. It parses source with the official TypeScript compiler API, hard
fails on anything dynamic, and emits LLVM IR that clang/LLVM turn into native
binaries for x86_64, ARM64, and WebAssembly.

Targets, in priority order:

1. **Correctness by construction.** No `any`, no dynamic properties, no GC.
   If it compiles, memory layout is fixed and known.
2. **Rust-class output.** Sub-megabyte (in practice sub-100 KB) binaries,
   `-O3` loop/math speed, zero-cost abstractions, LTO and dead-stripping.
3. **Zero-GC memory.** Arena/bump allocation by default, explicit reset,
   optional reference counting only for objects that must outlive an arena.
4. **Node/npm interop in one direction only.** Nish exports `.wasm` /
   native addons that Node imports. Nish never embeds a JS engine.

Non-goals: running arbitrary TypeScript, JS semantics for `number` overflow,
prototypes, `eval`, reflection, exceptions as control flow.

## 2. Architecture: the three-layer stack

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. Developer UX                                                  │
│    Biome: format-on-save, style lint. Advisory only. Never a     │
│    correctness gate.                                             │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. Compiler frontend (this repo, src/)                           │
│    Phase 0  validator.ts   forbidden-syntax sweep, hard fail     │
│    Phase A  parser.ts      ts.createSourceFile                   │
│    Phase B  checker/       Nish types, scopes, side tables│
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. Compiler backend                                              │
│    Phase C  codegen/attributes.ts  purity / escape / loop facts  │
│             codegen/emitter.ts     AST -> LLVM IR text           │
│             codegen/runtime.ts     runtime ABI, inline allocator │
│    runtime/runtime.c               arena + strings (C, 3.5 KB)   │
│    runtime/runtime_os.c            files, spawn, env (C, 1.2 KB) │
│    scripts/build.sh                clang -O3/-Oz, LTO, gc-sections│
└──────────────────────────────────────────────────────────────────┘
```

Design rules that every WP must respect:

- **Checker records, emitter reads.** The checker writes types and bindings
  into side tables (`CheckedProgram.types/bindings/locals/callees`). The
  emitter contains no user-facing error handling; any node it sees is valid.
- **Attributes are guarantees.** An LLVM attribute is emitted only when the
  checker has proved it. A wrong attribute is undefined behaviour.
- **ABI is a contract.** Struct layouts in `codegen/runtime.ts` and
  `runtime/runtime.c` must match byte for byte, and a test must prove it
  (see `tests/ir/alloc_smoke.ll`).
- **Every construct ships with a golden test** (`.ts` in, `.ll` out) and a
  native round trip (link with clang, run, compare stdout).
- **Runtime stays tiny.** Two budgets, one per translation unit: `runtime.c`,
  the core every program touches, under 3,584 bytes of compiled code, and
  `runtime_os.c`, the half whose subject is the operating system, under 1,280 —
  counted as every `.text*` section summed
  (`clang -Oz -c runtime/runtime.c && size -A runtime.o`, and the same for
  `runtime_os.c`). No stdio on hot paths. The split is what makes the core's
  ceiling mean something: it can come down over time and never up, because
  nothing in the language roadmap adds an arena or a second string
  representation, while the OS-facing half is exactly the surface that grows as
  the language reaches further out, and it can no longer borrow room from the
  arena to hide in. The two figures the byte count replaces were the *source*
  bytes, over budget since WP4 and left there because comments are not code,
  and the `text` column of `size`, which counts the `.eh_frame` unwind entries
  the `size` build profile strips — measuring the bytes that never ship. The
  sum rather than the `.text` line alone is what a linked binary pays:
  `clang -Oz` puts cold code in `.text.unlikely.`, so a ceiling on `.text` by
  itself can be met by moving code into another section instead of by making it
  smaller. And `-ffunction-sections -Wl,--gc-sections` means a binary pays only
  for the functions it calls: adding WP14's `nish_mkdir` and `nish_spawn` left
  `examples/hello.ts` at 4,696 bytes, the same number to the byte. Today:
  3,480 of 3,584 and 1,190 of 1,280, both measured by `tests/run.js` rather
  than by a reviewer (`node tests/run.js budget`); `docs/wp7-runtime.md`
  §"Runtime additions and budget" records each measurement, why the single
  4,864-byte ceiling became two, and what the split costs a program.

## 3. Consolidated language specification (Nish)

### 3.1 Types

| Nish | LLVM | Notes |
| --- | --- | --- |
| `number` | `i32` (default) or `double` (`--number-mode f64`) | Wrapping integer arithmetic, no `nsw`. |
| `i32`, `f64` | `i32`, `double` | Explicit, always available. |
| `i64` | `i64` | WP7. |
| `boolean` | `i1` | `zeroext` at ABI boundaries. |
| `string` | `i8*` to `{ i64 len, i8 data[len], i8 0 }` | Immutable, 8-aligned, arena or constant. |
| `void` | `void` | |
| `class` / `interface` | `%struct.Name = type { ... }` | Fixed fields, declared order, natural alignment. WP2. |
| `T[]` | `%array.T = type { i64 len, T* data }` | Fixed element type, bounds-checked. WP4. |
| `T \| null` | nullable pointer | WP6, pointer types only. |

### 3.2 Forbidden (Phase 0 validator, hard compile error)

`any`, `unknown`, `never` in value positions, `eval`, `Function`, `Proxy`,
`Reflect`, `with`, `delete`, `typeof`/`instanceof` on values, `in`,
element access `obj[key]` except on arrays with numeric index, computed
property names, spread of objects, prototype access (`__proto__`,
`.prototype`), `Object.assign`/`defineProperty`, adding properties not
declared on the class, `var`, loose `==`/`!=`, `arguments`, `this` outside
methods, generators, `async`/`await`, decorators, enums with computed
values, namespaces, `declare global`, dynamic `import()`, optional chaining
and nullish coalescing on non-nullable types, union types other than
`T | null`, type parameters on a class, an interface, a method or a type
alias (a generic *function* is monomorphised, WP18), `symbol`,
`bigint`, regex literals, `try`/`catch` and `throw` (no unwinding; a failure is a `Result<T, E>`, WP16).

### 3.3 Semantics decisions already made

- Signed integer overflow is undefined behaviour (`nsw`, C semantics);
  `--wrapping` restores two's-complement wrapping (Rust release semantics).
  Unsigned overflow is defined as wrapping in both modes. Was "overflow
  wraps" until WP15 §3 flipped the default; see docs/LANGUAGE.md.
- Strings are immutable and shared by pointer; equality is by content.
- Functions are `nounwind`; there is no `throw` (WP16), and `panic(message)` prints and exits 1.
- Parameters are immutable (`const` semantics) and used as SSA values.
- Locals use `alloca`/`load`/`store` with natural alignment; `opt -mem2reg`
  promotes them, so this is free.
- Only `export`ed functions carry the C ABI; every other top-level function is
  `internal`, so LLVM may inline, specialise or drop it. `--no-strict-exports`
  makes them all external again (WP15 §3).

### 3.4 Open decisions (need an owner, do not block Wave 1)

| Question | Options | Recommendation |
| --- | --- | --- |
| Default `number` mode | `i32` (fast, current) vs `f64` (JS semantics) | Keep `i32` default; document loudly; `f64` via flag or per-file pragma. |
| Overflow | wrap / trap / `nsw` UB | **Decided (WP15 §3): `nsw` UB by default, `--wrapping` to opt out.** A trap mode is still open. |
| Class inheritance | none / single with prefix layout / interfaces only | **Decided (WP25): none.** `extends` was built and then removed; the field-prefix layout it bought survives as a prefix-checked `implements`. |
| Object lifetime | arena only / arena + RC / escape-analysed stack | Arena + escape-analysed `alloca` (WP6); RC opt-in per class. |
| String encoding | UTF-8 bytes (current) vs UTF-16 (JS) | UTF-8; `.length` is byte length, documented. |

## 4. What exists today

There are now **two compilers for one language**, and the second is written in
the language they both compile: `src/` (stage0, TypeScript on Node, 16,210
lines) and `self/` (stage1, the same compiler in Nish, 22,395 lines).
They agree byte for byte on the IR of every program in the corpus, which is
what WP14 below means by self-hosting. `.claude/orientation.md` is the
ninety-second map; the table below is the inventory.

| Area | State | Files |
| --- | --- | --- |
| CLI and driver: `-o <file>` / `-o <dir>/`, `--link`, `--profile`, `--number-mode`, `--target`, `--nsw`, `--strict-exports`, `--unchecked-indexing`, `--no-stack-alloc`, `-g`, `--json`, the dumps, `--version`, exit codes 0/1/2/3/70 | done (WP5, WP9, WP10, WP12) | `src/index.ts`, `src/compilation.ts`, `src/version.ts` |
| Phase A parse and Phase 0 validate: the forbidden-syntax sweep, with the message and the `reject_*` case for every rule | done (WP0) | `src/parser.ts`, `src/validator.ts` |
| Checker, pass 1 signatures / pass 1b imports / pass 2 bodies, dispatch tables keyed by `ts.SyntaxKind`, side tables in `program.ts` | done | `src/checker/` (21 modules, one per construct family: `classes`, `arrays`, `strings`, `math`, `bitwise`, `narrowing`, `nullable`, `result`, `arena`, `io`, ...) |
| Emitter: SSA temps, hoisted allocas, control flow, structs, arrays, strings, `Result`, builtins, one module per source file | done | `src/codegen/emitter.ts`, `ir.ts`, `emit/` (15 modules) |
| Attributes and escape analysis: the whole-program purity / termination / escape fixpoint behind `nounwind`, `willreturn`, `readnone`/`readonly`, `noundef`, `zeroext`, `noalias`, `nonnull`, `nocapture`, `dereferenceable`, `align`, `nsw` | done (WP9) | `src/codegen/attributes.ts`, `escape.ts` |
| Debug info: a compile unit, a `DISubprogram` per function, `DILocation` on every instruction, `llvm.dbg.value`/`declare`, `-g` carried on to the link | done (WP10, WP17) | `src/codegen/debug.ts` |
| Interop sidecars: C header, `.d.ts` plus its `.mjs` loader, N-API shim, the `napi` build profile — a `Result` included (WP17) | done (WP8) | `src/interop/` (`abi`, `header`, `dts`, `wasm`, `napi`) |
| Runtime: chunked arena with O(1) reset and mark/release, strings, `Math`, I/O, `process.*`, `mkdirSync`, `spawnSync`; the wasm/WASI twin and the Node shim the differential tests run against | done | `runtime/runtime.c` (1,138 lines) and `runtime/runtime_os.c` (290 lines, the system-call half), `runtime_wasm.c`, `nish.h`, `shim.mjs` |
| Inline `alwaysinline` bump allocator in IR, the runtime ABI table both sides agree on | done | `src/codegen/runtime.ts` |
| Build profiles `debug`, `speed`, `size`, `wasm`, `wasi`, `napi`, the PGO recipe, the size report | done (WP9) | `scripts/build.sh`, `scripts/size-report.sh` |
| The self-hosted compiler: lexer, parser, checker, emitter, interop sidecars, DWARF, and its own driver — it plans its output, makes its directories and runs `scripts/build.sh` for `--link` | done (WP14) | `self/` (54 modules), `scripts/bootstrap.sh` |
| Tests: 382 golden cases (229 of them `reject_*`), 24 `tests/link/` programs, `llvm-as`, native round trips, runtime unit tests, IR/C layout smoke, size and wasm builds, interop, exit codes, packaging, bench checksums | done | `tests/run.js` and `tests/cases/`, `link/`, `ir/`, `layout/` |
| Differential testing against Node: 50 corpus programs plus `tests/cases`, rewritten from the checker's own types, and a fuzzer that prints its seed | done (WP13) | `tests/differential/`, `runtime/shim.mjs` |
| The stage1 oracles: lexer, parser, support, types, diagnostics, symbols, checked dump, rejections, IR, interop sidecars, and the bootstrap | done (WP14) | `tests/lexer_oracle.js`, `tests/parser_oracle.js`, `tests/self/` |
| Benchmarks: seven programs in Nish, C and Rust, with wall time, binary size, peak RSS and checksums | done (WP9) | `bench/`, `docs/BENCHMARKS.md` |
| Docs: the normative reference, the regenerated IR cookbook, the architecture, the FAQ, install, and one design note per package | done (WP11) | `docs/` |

Measured today: `examples/hello.ts` links to 4,680 bytes at the `size` profile
and the runtime costs 4,670 bytes of `.text*` across its two translation units
— 3,480 of `runtime.c`'s 3,584-byte budget and 1,190 of `runtime_os.c`'s 1,280
(`docs/wp7-runtime.md` §"Runtime additions and budget") — beside 9,920
bytes of `.rodata` that Ryu's tables dominate and that only a binary formatting
a double links (WP15 §7a)
(`docs/wp14-selfhost.md` §7a); the benchmark binaries are 5.5-12 KB against
14.5 KB for the C twins and 349-377 KB for the Rust ones
([BENCHMARKS.md](BENCHMARKS.md)). stage1 compiles the same programs about
eight times faster than stage0 (`docs/wp14-selfhost.md` §4, D5).

## 5. Work packages

Sizes: S = under a day of agent work, M = one to two days, L = several days.
"Parallel-safe" means the WP mostly adds files rather than editing the shared
`checker.ts`/`emitter.ts` hot spots (see WP-P).

WP-P through WP11 are the original cut and have all landed. The one piece that
was outstanding, WP2b's virtual dispatch, is no longer pending but withdrawn:
inheritance has been removed and dispatch stays static
([wp25-inheritance.md](wp25-inheritance.md), §6). WP12 through WP17 were cut afterwards, as the work turned up,
and are recorded here in the same form so that this section says what happened
rather than only what was planned: five of them have landed, and WP15 is the
roadmap the project is on now. Each entry carries its state in its heading.

### WP-P: Pipeline prep for parallel work (S) — do first

Goal: make `checker.ts` and `emitter.ts` extensible by adding files, so
Wave 1 agents do not all edit the same two functions.

- Split `checkStatement`/`checkExpression` and `emitStatement`/`emitExpression`
  into dispatch tables keyed by `ts.SyntaxKind`, with one module per
  construct family: `src/checker/{statements,expressions,declarations}.ts`,
  `src/codegen/emit/{statements,expressions}.ts`.
- Introduce a golden-test harness: `tests/cases/<name>.ts` + `<name>.ll` +
  optional `<name>.out` (expected stdout when linked with `tests/driver.c`
  that calls `main`) and `<name>.err` for negative cases. `tests/run.js`
  discovers them.
- Add `npm run check` (tsc --noEmit) and `npm run lint` (Biome, WP0 wires it).

Acceptance: `npm test` unchanged and green; existing goldens byte-identical.

### WP0: Phase 0 AST validator + Biome for DX (S, parallel-safe)

Goal: a dedicated, un-bypassable forbidden-syntax sweep that runs before the
checker, plus Biome configured purely as a formatter/linter for humans.

- `src/validator.ts`: `validateNish(sourceFile)` walks the whole tree
  with `ts.forEachChild` and throws `CompileError` for everything in §3.2.
  It must catch things the checker never reaches (e.g. `any` nested in a
  type argument, `delete` inside an unreachable branch).
- Wire it into `src/compiler.ts` as Phase 0. Keep the checker's own checks;
  the validator is defence in depth, not a replacement.
- `biome.json` with format + recommended lint for the compiler's own source
  and `examples/`. `npm run lint`, `npm run format`. Biome output is never
  consulted by the compiler.
- Tests: one `tests/cases/reject_*.ts` per forbidden construct (at least 25)
  with the expected message fragment in `.err`.

Acceptance: every §3.2 item has a rejecting test; `npm run lint` passes on
the repo; validator runs in under 5 ms on a 1,000-line file.

### WP1: Control flow (M, edits emitter core)

Goal: `if`/`else`, `while`, `do`/`while`, `for`, `break`/`continue`,
ternary `?:`, short-circuit `&&`/`||`, compound assignment `+= -= *= /= %=`,
`++`/`--`, `throw` (abort).

- Lowering: named blocks (`if.then`, `if.else`, `if.end`, `while.cond`,
  `while.body`, `while.end`), `br i1`, `phi` for ternary and short-circuit,
  alloca-based mutation for loop variables (mem2reg cleans it up).
- Block naming must be unique per function (`if.then.1`, ...). Unnamed temp
  numbering rules from `ir.ts` still hold.
- Checker: definite-return analysis through branches; unreachable-code
  detection after `break`/`continue`/`return`; `break` outside loop is an
  error; condition must be `boolean` (no truthiness coercion).
- Attributes: `hasLoops` already exists; a loop with a compile-time bounded
  trip count (`for (let i = 0; i < n; i++)` with `n` unmodified in body)
  may keep `willreturn`; otherwise drop it. Add `mustprogress` never (JS
  allows infinite loops).
- Runtime: `nish_abort(msg)` for `throw`.

Acceptance: goldens for each construct; native round trips for fib, gcd,
collatz, nested loops; `opt -O2` output vectorises a simple sum loop
(check for `<4 x i32>` in `opt -O2 -S`); Rust/C comparison benchmark for
fib(35) within 10 % (WP9 formalises the harness, a quick `hyperfine` run is
enough here).

### WP2: Classes, interfaces, structs (L, depends on WP1 for methods with loops)

Goal: `class` and `interface` as LLVM struct types with fixed fields.

- `%struct.User = type { i32, double }`; field order as declared; natural
  alignment; `align 8` on allocations.
- `new User(...)` lowers to the inline `nish_alloc_struct` (size from
  datalayout-independent constant computed by the compiler) then a
  constructor call. Constructors and methods become functions with `this`
  as the first parameter: `@User.greet(%struct.User* noalias nonnull align 8 %this, ...)`.
- Field access via `getelementptr inbounds`, `load`/`store` with alignment.
- Interfaces: structural type with the same layout rules; a class
  `implements` an interface only if fields match exactly in order and type
  (no vtables in this WP).
- Object literals typed by an interface allocate in the arena.
- Forbidden and validated: adding undeclared fields, optional fields,
  index signatures, getters/setters (defer), `static` (allowed as free
  functions), inheritance (defer to WP2b).
- Attributes: `noalias` on `this` and struct params only when the checker
  proves no other pointer to the same object is live in the call (start
  conservative: `noalias` only on `this` for constructors, since the object
  is fresh). `readonly` on struct params never written through.
- WP2b (follow-on): single inheritance via struct prefix + `bitcast`,
  `super()`; still no virtual dispatch.

Acceptance: goldens for class decl, `new`, method call, field read/write;
C driver reads fields directly through a matching C struct; layout test
comparing `sizeof` from C against the compiler's computed size for ten
mixed structs.

### WP3: Strings (M, parallel-safe after WP-P)

Goal: string literals, `+` concatenation, `===`/`!==`, `.length`, template
literals, `console.log`, number-to-string.

- Literals: `@.str.N = private unnamed_addr constant { i64, [N x i8] } { i64 len, c"...\00" }, align 8`,
  referenced as `i8*` via `getelementptr`. Deduplicate identical literals.
  UTF-8 bytes, escaped for LLVM (`\XX` hex).
- `a + b` on strings lowers to `nish_str_concat`; `a === b` to `nish_str_eq`;
  `s.length` to a direct `load i64` from the header (no call).
- Template literals: fold constant parts, `nish_str_from_i32/f64` for holes,
  chain concat (or a `nish_str_concat_n` runtime addition).
- `console.log(x)` accepts string, number, boolean; lowers to `nish_print`.
- Number to string: `nish_str_from_f64` must match JS `Number.prototype.toString`
  (shortest round-trip). Port Ryu or Grisu-style shortest formatting to
  `runtime.c` within budget, or accept `%.17g` and document until WP7.
- Mark functions that only call `nish_str_len` as `readonly` (already
  handled by the effect fixpoint; verify with a test).

Acceptance: goldens; native round trip printing concatenations and
template literals; identical literal emitted once; `runtime.c` stays under
budget.

### WP4: Arrays (M, depends on WP1 and WP2 layout rules)

Goal: `number[]`, `string[]`, `User[]` with fixed element type.

- Layout `%array.i32 = type { i64, i32* }` (header + data pointer) or
  inline `{ i64 len, [0 x T] }`; pick one and document. Recommendation:
  header + pointer so slices are cheap later.
- Array literals allocate in the arena; `new Array<T>(n)` zero-initialises.
- `a[i]` with numeric index only; bounds check emits `br` to a cold
  `nish_abort("index out of range")` block; `--unchecked-indexing` flag
  removes it for benchmarks.
- `.length`, `for (const x of arr)`, `for` with index; `push` deferred
  (needs growth strategy; arena realloc doubling is fine).
- Typed views for interop: `Int32Array`/`Float64Array` map to the same
  layout so Node can pass buffers (WP8).

Acceptance: goldens; native round trip summing an array and sorting one
(insertion sort in Nish); bounds failure exits non-zero with message;
`opt -O2` vectorises the sum loop with checks hoisted or removed.

### WP5: Modules, entry point, linkage (M, parallel-safe)

Goal: multi-file programs and runnable binaries without a hand-written C driver.

- `export function` keeps external linkage; non-exported functions become
  `internal` under `--strict-exports`, which WP15 §3 later made the default
  (`--no-strict-exports` is now the opt-out).
- `import { f } from "./other"`: compile each file to its own `.ll`, emit
  `declare` for imported symbols with the same attributes the exporter
  computed (write a `.d.nish.json` sidecar with signatures and attributes),
  link them with `build.sh`. Cycles are allowed at link time.
- `export function main(): number` becomes the process entry: emit
  `@main` wrapper that initialises nothing (arena is lazy), calls user
  `main`, calls `nish_free_arena`, returns the code. Process args exposed
  later (WP7).
- CLI: `nish a.ts b.ts -o out/` and `nish --link a.ts b.ts -o app`
  which shells out to `scripts/build.sh`.

Acceptance: two-file example builds and runs with `nish --link`;
attributes on imported declarations match the exporter's definitions
(test compares the sidecar with the `.ll`).

### WP6: Memory strategy (L, depends on WP2 and WP4)

Goal: make the zero-GC model ergonomic and fast.

- Escape analysis: a `new` whose result never escapes the function (not
  returned, stored into another object, or passed to a capturing callee)
  becomes an `alloca` in the entry block instead of an arena allocation.
  Reuse the escape machinery from `attributes.ts`.
- Arena scopes in the language: `arena.scope(() => { ... })` or a block
  pragma; compiles to save-offset / restore-offset around the block, so
  temporary objects are reclaimed without a full reset. Runtime gets
  `nish_arena_mark()` / `nish_arena_release(mark)`.
- Optional reference counting per class (`@refcounted` decorator or
  `class X extends Rc`): 8-byte header, `nish_rc_retain/release`, release
  on scope exit, no cycles collection (documented). Only for objects that
  must outlive resets. Off by default.
- `T | null` for pointer types with `null` checks required before use
  (checker enforces narrowing via `if (p !== null)`).

Acceptance: goldens showing `alloca` for non-escaping objects; benchmark
allocating 10 M small objects in a loop with scope reclaim stays flat in
RSS; RC round trip test in C confirms counts.

### WP7: Runtime and intrinsics expansion (M, parallel-safe)

- `Math.sqrt/abs/floor/ceil/min/max/pow/sin/cos` to `llvm.*` intrinsics
  with `readnone`; `Math.random` via xorshift in runtime.
- `i64` type; `number`-to-`i64` explicit conversion functions; `Number()`
  / `parseInt` on strings.
- I/O: `process.argv`, `readFileSync`/`writeFileSync` (thin `read`/`write`
  wrappers), `process.exit`. Keep stdio out; use syscalls via libc.
- JS-accurate float formatting (shortest round-trip) if WP3 deferred it.
- WASI variant of the runtime (`--target wasm32-wasi`) so string programs
  run under wasm too.

Acceptance: runtime budget respected; each intrinsic has a golden and a
native check against libm; a CLI sample (word count) builds under 20 KB
with the `size` profile.

### WP8: Interop: wasm, N-API, headers (M, depends on WP5)

- `nish --emit-header` writes a C header for exported functions and
  structs from the same signature data the emitter uses.
- `nish --emit-dts` writes `.d.ts` for the wasm exports (scalars now,
  arrays via `Int32Array` views over wasm memory after WP4).
- `scripts/build.sh --profile napi` builds a `.node` addon: generated C
  shim registers each exported scalar function; `examples/node-addon.mjs`
  loads it.
- Guidance and examples for batching: pass a buffer once, process
  natively, return once. Benchmark showing per-call FFI cost versus batched.

Acceptance: `node` loads both the `.wasm` and the `.node` build of the
same module and gets identical results; header compiles with `-Wall
-Werror` against the IR-built object.

### WP9: Optimisation and benchmarking (M, after WP1/WP2/WP4)

- Benchmark suite `bench/`: fib, nbody, spectral-norm, string building,
  struct-heavy loop; each in Nish, C, and Rust; `hyperfine` runner and
  a table in `docs/BENCHMARKS.md`. Target: within 10 % of Rust `-O3` for
  loop/math, sizes within the Rust range.
- Attribute phase 2: `nsw` under an opt-in flag; `noalias` on struct
  params under a documented aliasing rule; `nocapture` with stores
  tracked; `dereferenceable(N)` on struct pointers (size known); `nonnull`
  everywhere pointers are non-nullable; `unnamed_addr` on constants;
  `dso_local` when not building PIC.
- Emit `target datalayout` and `target triple` when `--target` is given so
  `opt` runs with the right layout; keep target-neutral by default.
- PGO recipe (`-fprofile-generate`/`-fprofile-use`) in `build.sh`.

Acceptance: `docs/BENCHMARKS.md` with reproducible numbers; no attribute
added without a test proving the precondition.

### WP10: Tooling, CI, diagnostics (S, parallel-safe)

- GitHub Actions: install LLVM 18 + lld, `npm ci`, `npm test`, size report
  as a job summary; matrix Linux + macOS.
- Diagnostics: multi-error reporting (collect, do not throw on first),
  source excerpt with caret, `--json` output for editors.
- `--emit-ast` and `--emit-checked` debug dumps.
- Debug info: `!dbg` metadata for functions and lines (`-g` flag) so
  `gdb`/`lldb` step through `.ts` lines.

Acceptance: CI green on both OSes; a file with three errors reports all
three; `lldb` shows a `.ts` line on a breakpoint in the fib example.

### WP11: Documentation (S, continuous)

- `docs/LANGUAGE.md`: the normative Nish reference (from §3, kept in
  sync by every WP that adds a construct).
- `docs/IR_COOKBOOK.md`: for each construct, the `.ts` and the exact `.ll`.
- README stays the tour; deep material moves to `docs/`.

### WP12: Release engineering and production hardening (S, after WP10) — landed

Goal: make the compiler something a stranger can install, and make its
refusals legible.

- `package.json#files` whitelists what `npm pack` ships; `src/index.ts`
  resolves `scripts/build.sh` and `runtime/runtime.c` from the package root
  (`PKG_ROOT`), never from the working directory, so `npm install -g` works
  from anywhere.
- Exit codes 0, 1, 2, 3 and 70, each with a documented message shape. The
  toolchain probe runs *before* compilation, so a missing clang is reported
  without writing any IR.
- `--version` read from `package.json` at runtime, `prepublishOnly` re-running
  check/build/test, `scripts/smoke.sh` building and running every example, and
  a tag-driven release workflow that refuses a tag disagreeing with
  `package.json#version`.

Dependencies: WP10 (the release workflow calls CI).

Acceptance (met): the packaging block of `tests/run.js` runs `npm pack`,
installs the tarball into a temporary prefix and links a hello-world from an
unrelated directory with the installed `nish`; every exit code above has its
own check, including the internal-error path through a test hook.
[wp12-release.md](wp12-release.md) is the note, and it carries the one decision
this package left open: *which* compiler the package should ship.

### WP13: Differential testing against Node (M, after WP5 and WP7) — landed

Goal: prove that a compiled program behaves exactly like the same TypeScript
run under Node, up to the handful of semantic decisions this compiler
documents.

- `tests/differential/rewrite.js` rewrites a whole program to JavaScript *from
  the checker's own types*, so what is compared is the language's semantics
  rather than a hand translation; `runtime/shim.mjs` is the Node side of the
  runtime.
- 50 corpus programs plus every whole program in `tests/cases`, built
  natively and run, compared byte for byte on stdout, exit status and
  terminating signal.
- A random-program generator that prints its seed, so any failure reproduces
  with `--seed <s> --count 1`.
- `known-failures.txt`: a divergence that is by design is listed with the
  paragraph that explains it; anything else is a bug.

Dependencies: WP5, WP7.

Acceptance (met): `npm run test:diff` green over the corpus, and `npm test`
runs the quick corpus plus a fixed-seed fuzz batch. No wrong instruction
sequence was found; three semantic gaps were, all since closed or documented
(ECMAScript `Math.pow`, and checked integer division for `x / 0` and
`INT_MIN / -1`). The generator has since gained a second customer in WP14,
where `--stage1` compares the two compilers' IR instead of Node.
[wp13-differential.md](wp13-differential.md).

### WP14: Self-hosting (L, after WP8) — landed

Goal: the compiler compiles itself. `self/` is `src/` rewritten in Nish,
and the claim is an equality rather than a demo:
`IR(stage1, self/) == IR(stage2, self/)` byte for byte, with stage3 identical
to stage2.

- **Nish-0**, the subset `self/` is written in — no generics, closures,
  nested functions, `type` aliases, `static` members, `try`/`catch` or
  downcasts — and what it forces: one `Node` class with a `kind` discriminant,
  interned integer types, `StringMap` over parallel arrays, error-value
  threading instead of exceptions, side tables as arrays indexed by node id.
- The language gap measured first and closed construct by construct, each one
  entering `src/` with its golden, round trip, negatives, LANGUAGE.md rule and
  cookbook entry before it entered `self/`.
- An oracle per phase (lexer, parser, support, types, diagnostics, symbols,
  the checked dump, the rejections, the IR, the interop sidecars), each
  comparing stage1 against stage0 over the whole corpus rather than against a
  hand-written golden.
- `scripts/bootstrap.sh` builds the chain and leaves `build/nish` behind;
  `--verify` runs the three equalities with `cmp` — all three for a stage0
  seed, and the two that do not mention the seed for any other, since
  `IR(seed) == IR(stage1)` is diverse double-compiling only when the seed is
  the second implementation (`docs/wp19-stage0-retirement.md` G3).
- §7a reversed decision D4: `mkdirSync` and `spawnSync` entered the language,
  so stage1 plans its own output, makes its own directories and runs
  `scripts/build.sh` itself. The wrapper `scripts/nish.sh` is deleted.

Dependencies: WP0 through WP8; WP16 and WP17 were implemented on both sides
for the same reason.

Acceptance (met): `tests/self/bootstrap.js` proves the three equalities on
every run of `npm test`, and the IR oracle requires stage1 to compile every
program in the corpus with no exemption list. What is still stage0's is listed
in full in [wp14-selfhost.md](wp14-selfhost.md) §7a: `--emit-ast`,
`--target host`, exit 70 for an internal error, and `-o <dir>` without a
trailing slash.

### WP15: Performance first (L, continuous) — the live roadmap

Goal: the fastest binary this compiler can emit, with binary size second. The
rule is that when a language decision has two defensible answers the faster
lowering wins, and that "faster" means measured rather than assumed.

Scope, eight items in dependency order: fast defaults (`--strict-exports` and
`--nsw` on, with the honest re-pointing of every test and document that
depends on wrapping — **done**); the `performance` diagnostic class, a third
severity that fires when the compiler had to take a slow path and a faster one
existed;
slice iterators, so `for (const c of s)` lowers to pointer advancement;
unsigned types; the fast slice beside JavaScript's `substring`; the range
analysis that makes a proven index emit no bounds check;
contiguous *record* arrays with the checker rule that makes the dangling
interior pointer a compile error (**done** for an `interface` nobody
implements, 2.27x where allocation order and traversal order differ; a class
has identity and keeps its pointer slot, and §2a says what that migration
would be); and generics by monomorphisation with discriminated unions. §9 has the
order with the reason for each position, and
[wp15-performance.md](wp15-performance.md) has the design.

Dependencies: WP9 (it is what the numbers are measured against). Items 1 and 7
change the ABI and the documented overflow guarantee, so each ships with the
re-pointing rather than after it.

Acceptance: each row ships with the full construct checklist of
`docs/ARCHITECTURE.md`, and the row that claims a speed-up cites the
before/after in [BENCHMARKS.md](BENCHMARKS.md).

### WP16: `Result<T, E>` and the end of `throw` (L, after WP6) — landed

Goal: a function that can fail says so in its return type, and the caller
cannot reach the success value without first deciding what happens to the
failure.

- Three checker rules, each a hard error: a `Result` cannot be dropped;
  `r.value` is legal only where `isOk()` was proved and `r.error` only where
  `isErr()` was; `r.orReturn()` — Rust's `?` — is legal only inside a function
  that returns a compatible `Result`.
- `throw` removed in the same package, because leaving it in would have left a
  second, invisible way to report a failure. It never unwound: it was an abort
  wearing the syntax of error handling. `panic(message)` is the replacement for
  a broken invariant.
- One monomorphised `%struct.nish_result.<T>.<E>` per payload pair, laid out
  as a `class` is, without generics in the language: the checker instantiates
  the pair it sees.
- The ambient declarations in `runtime/nish.d.ts` keep an Nish program
  type-checkable by `tsc`.

Dependencies: WP6 (the escape analysis and the narrowing engine `T | null`
already had).

Acceptance (met): six `res_*` cases, ten `reject_result_*` messages matching
character for character, the `result_import` link test, and both compilers
agreeing byte for byte through the S3/S4 oracles.
[wp16-results.md](wp16-results.md).

### WP17: `Result` across the ABI (M, after WP16) — landed

Goal: close the three things WP16 left in the source: return small `Result`s
by value, let a `Result` cross the host boundary, and describe one in DWARF.

- A `Result` whose two payloads are each a scalar of at most four bytes travels
  packed into a single `i64` — returned *and* passed — with the discriminant in
  the low half and the live arm in the high half. Everything else keeps WP16's
  pointer. Eight bytes is not a tuning knob: `i64` is the only return width
  whose C-ABI lowering is the same LLVM type on all six supported triples.
- `--emit-header` writes the encoding as a C type with a `_Static_assert` on
  its size, so the header is the same declaration clang produces rather than a
  description of it; `--emit-dts` and `--emit-napi` hand JavaScript the object
  it already models.
- `-g` describes the fields.

Dependencies: WP16, WP8 (the sidecar generators), WP9 (`target.ts`).

Acceptance (met): 3.5× on the inlined path, measured on two real binaries, and
2.09× against WP16's pointer where the call is not inlined away, measured on
hand-written IR that mimics each lowering because (c) was never built; a
`-Wall -Wextra -Werror -pedantic` C driver calling by-value, by-pointer and
by-parameter `Result`s through the generated header; and the oracles agreeing
byte for byte before the bootstrap was allowed to close.
[wp17-result-abi.md](wp17-result-abi.md). What it did *not* close is
`bench/result`, which was 2.59x behind Rust because the two arms never become
separate SSA values inside one word — the fix is a private ABI for internal
functions, which needs WP15's item 1. It shipped as WP15 §7b, in two steps
(the discriminant out of the word, then one payload slot per arm), and the row
is 1.00x.

## 6. Dependency graph and waves

```
WP-P ─┬─► WP0 ─────────────────────────────────────────┐
      ├─► WP1 ─┬─► WP2 ─┬─► WP4 ─┬─► WP6              │
      │        │        │        ├─► WP9 (needs 1,2,4)  │
      ├─► WP3 ─┘        │        │                      │
      ├─► WP5 ──────────┴─► WP8 ─┘                      │
      ├─► WP7                                           │
      ├─► WP10                                          │
      └─► WP11 (continuous) ◄───────────────────────────┘
```

| Wave | Packages | Parallelism | State |
| --- | --- | --- | --- |
| 0 | WP-P | one agent, lands first | done |
| 1 | WP0, WP1, WP3, WP5, WP7, WP10 | six agents, disjoint files after WP-P | done |
| 2 | WP2, WP4 (WP4 starts once WP2 fixes layout rules), WP8 | three agents | done |
| 3 | WP6, WP9, WP2b | three agents | done. WP2b's inheritance landed and has since been **removed** ([wp25-inheritance.md](wp25-inheritance.md)); the field-prefix half it was good for survives as a widened `implements`, and virtual dispatch was never built |
| 4 | WP12, WP13 | two agents, both additive | done |
| 5 | WP14, then WP16 and WP17 on both compilers | one agent at a time: `self/` is the whole tree | done |
| 6 | WP15, in the order of §9 | one agent per numbered item; items 1 and 7 move the ABI, so they do not overlap | **open** |
| always | WP11 | folded into each WP's definition of done | done |

Merge order inside a wave: smallest diff first (WP0, WP10), then WP3/WP5/WP7,
then WP1. Each agent rebases on the branch head before pushing.

Waves 4 to 6 are not in the diagram above because they do not fork: WP12 and
WP13 depend on a working compiler rather than on a construct, WP14 depends on
all of it, and every WP15 item is measured against the baseline the one before
it left. What the diagram would show for them is a line.

## 7. Conventions for every agent

1. Work on a sub-branch of `main` named `wp<N>/<short-name>`; open a PR into
   `main`.
2. `npm test` must be green, and every new construct needs: a golden `.ll`,
   an `llvm-as` pass, a native round trip with expected stdout, and at least
   one negative test. Run `opt -passes=verify` on every emitted module.
2a. A construct is implemented in `src/` *and* `self/`, which the oracles
   compare byte for byte, or in `self/` alone with its case named in
   `tests/self/stage1_only.txt`
   ([wp19 §1a](wp19-stage0-retirement.md#1a-the-doubling-ends-before-r6)).
   Either is a decision; `self/` alone and unregistered is not, because the
   oracles would then stop comparing its case without anyone deciding they
   should. A new diagnostic also needs a case that *reaches its words*
   (`tests/diagnostic_coverage.js`, inside `npm test`), not only a code.
3. Do not emit an attribute you cannot cite a checker proof for. Write the
   reason in `attributes.ts` alongside the code.
4. Any change to a struct layout touches `runtime.ts` and `runtime.c` in
   the same commit and adds/extends a layout smoke test.
5. Keep `runtime.c` and `runtime_os.c` within their budgets (§2). Report the
   size of whichever you changed in the PR.
6. Update `docs/LANGUAGE.md` and the IR cookbook for what you added.
7. Commit messages: imperative subject, body explaining the lowering.
   No model names in commits, code, or PR text.
8. Never widen scope into another WP's files; leave a TODO referencing the
   WP number instead.

## 8. Agent brief template

```
You are implementing <WP-N: title> for Nish, a TypeScript-to-LLVM-IR AOT
compiler. Read docs/MASTER_PLAN.md (§2 design rules, §3 spec, §5 your WP,
§7 conventions) and README.md first. Run `npm test` before changing anything.

Scope: <paste the WP bullet list>.
Out of scope: <neighbouring WPs>.
Files you own: <list>. Files you may read but not edit: <list>.

Definition of done:
- <acceptance criteria from §5>
- `npm test` green, new goldens under tests/cases/, docs updated.
- Push to branch wp<N>/<name> and open a PR into `main` with the IR for each
  new construct shown in the PR body.

Show the exact LLVM IR for every TypeScript snippet you add to the tests.
```

## 9. Milestones

| Milestone | Contents | Proof | State |
| --- | --- | --- | --- |
| M1 "Programs" | WP-P, WP0, WP1, WP3, WP5, WP10 | fib/gcd/string CLI builds with `nish --link`, under 20 KB. | done |
| M2 "Data" | WP2, WP4, WP7 | nbody with structs and arrays, matches C output bit for bit. | done |
| M3 "Rust parity" | WP6, WP9, WP8 | benchmark table within 10 % of Rust; wasm and N-API demos. | done as a package; one of the seven benchmarks is outside 1.10x today — fib at 1.15x, which the run's own analysis reads as spread rather than the program ([BENCHMARKS.md](BENCHMARKS.md), [wp9-optimisation.md](wp9-optimisation.md#summary)). The other three closed: the causes were named rather than guessed, and each section below the gap table says what the measurement was before the change |
| M4 "1.0" | remaining docs, stabilised spec | tagged release, language reference frozen. | **open — the only one left.** WP2b has left the milestone rather than been finished: inheritance was removed and virtual dispatch is not coming ([wp25-inheritance.md](wp25-inheritance.md)), so what M4 still wants is the frozen reference and the tag |
| M5 "Self-hosting" | WP14 ([wp14-selfhost.md](wp14-selfhost.md)) | `self/` compiles `self/`: `IR(stage1, self/) == IR(stage2, self/)` byte for byte, and stage3 is byte-identical to stage2 (`tests/self/bootstrap.js`). | done |
| M6 "One compiler" | WP19 ([wp19-stage0-retirement.md](wp19-stage0-retirement.md)) | stage0 is deleted rather than frozen. The six gates of §3 there are closed first: parity, oracle succession, the seed protocol, the seed policy, distribution without Node, and the provenance tag. | open — after M4 |

WP12, WP13, WP16 and WP17 landed between M3 and M5 without a milestone of
their own; releasing what they built is part of M4.

### What remains

M4 and WP15 are the near road and M6 is the far one, and none of the three
is sequential with the others. The language reference cannot be frozen while
items 5, 6 and 8 below are each still going to add or withdraw a rule, so the
WP15 order *is* the road to 1.0 rather than a detour from it; WP22's
arrow-function migration and WP23's landing items change the reference too,
and are the separate road described further down this section. The list is
[wp15-performance.md](wp15-performance.md) §9, repeated here so that this
document does not need a second one open beside it to be current:

| | Item | Why in this position |
| ---: | --- | --- |
| 1 | Fast defaults: `--strict-exports` and `--nsw` on by default — **done** | small, and it moves the baseline everything after it is measured against. It is also what a private two-scalar ABI for `Result` needs (WP17 §4) |
| 2 | The `performance` diagnostic class — **done** | the framework — `--no-warn-performance` in `src/index.ts`, `PerformanceWarning` in `src/diagnostics.ts` — plus the two warnings that needed no new analysis, quadratic string building and allocation in a loop, ruled in `docs/LANGUAGE.md` and tested by `tests/cases/perf_*`. The other four warnings in WP15 §8 wait on the analyses that feed them |
| 3 | Slice iterators — **closed by measurement, not built** | the array half was already bought by WP15 §2b: a `for (const x of xs)` loop and the bounds-checked indexed loop beside it compile to byte-identical binaries today (wp15 §2, §9), and `for...of` over a string is declined in [wp23-language-surface.md](wp23-language-surface.md) §7 |
| 4 | Unsigned types `u8`, `u16`, `u32`, `u64` — **done** | specified in `docs/LANGUAGE.md`, carried through the N-API and wasm bridges, and tested by `tests/cases/u_*`. Foundational for 6, and it touched every numeric path, so earlier was cheaper |
| 5 | The fast slice beside JavaScript's `substring` | |
| 6 | Ranged types and length narrowing — **done, smaller than it was written** | the flow-sensitive analysis shipped (`src/checker/bounds.ts`, `self/bounds.ts`) with the surviving-check warning item 2 held back, which is what proves it worked. The *declared* surface did not: `integer<0, 255>` needs item 8's generics, so the sequencing forbids it, and the tuple form of the length guard buys nothing the facts do not. Measured 1.069x on item 3's lexer-shaped cursor against the 1.082x that removing every check buys on the same program — the hot function comes out byte-identical to the `--unchecked-indexing` build — and nothing measurable on a counted array loop, exactly as §2b predicted |
| 7 | Contiguous struct arrays | the layout change, the escape rule that makes the dangling interior pointer a compile error, and the interop surfaces that move with the ABI |
| 8 | Generics by monomorphisation; discriminated unions deferred to their own note | the largest. Generic **functions** have landed in both compilers — [wp18-generics.md](wp18-generics.md) §15 records what shipped and §16 the order for classes, constraints and the whole-program rule. `Result<T, E>` and `Array<T>` stay built-in rather than becoming library code, and §6.1 says why |

An explicit bounds-check opt-out is deferred until 6 has landed and the checks
that survive it have been counted. Both have happened: seventeen survive in a
loop across the whole of `self/`, each with a rewrite the warning names, which
is not a language feature's worth of them, so it stays unbuilt
([wp15-performance.md](wp15-performance.md) §2.4). What each item is worth is a measurement
and not a prediction: [BENCHMARKS.md](BENCHMARKS.md), regenerated by
`node bench/run.mjs`, is the only place the numbers are current, and one of
its seven programs is outside the 1.10x target today: fib at 1.15x against
Rust `-O3`, a row the same suite re-measures at 261 ms against Rust's 262 when
the runs are interleaved, so it is the spread and not the program
([wp9-optimisation.md](wp9-optimisation.md#summary)). The remaining work on
that list is therefore worth what it is worth for its own reasons, not because
a gap table is waiting on it.

Threads are not on that list and not in the waves above. The design question
"how does Nish do true multithreading, like Go or Rust" has an answer
that the zero-GC model and the attribute fixpoint force rather than leave
open — 1:1 OS threads with data races rejected at compile time, not
goroutines — and [wp20-threads.md](wp20-threads.md) is the plan of record for
it. Its first stage T0, a thread-local arena behind `--threads`, **has landed**:
it has no language surface and is a prerequisite for every version of the
design, so nothing about the freeze argued against it, and with the flag off it
changed no byte of IR, no golden and no binary — `runtime.c` is 4,670 of its
4,864-byte `.text*` budget either way. What it costs when a program does ask is
measured in [wp20-threads.md](wp20-threads.md) §4 T0. The four stages that add
rules to LANGUAGE.md cannot land before M4 without delaying the freeze, and are
1.1 scope by default.

Packages are not on that list either, and the question "how does one
Nish package depend on another" turns out to have the same character:
the answer is forced by whole-program compilation rather than chosen. A
foreign host — JavaScript on Node, JavaScript in a browser, C — takes a built
artifact across the ABI, which is what WP8 already generates; an Nish
consumer takes **source**, compiled as part of its own program, because a
prebuilt library cannot carry the attribute fixpoint of §3a, cannot contain a
generic that nobody has instantiated yet, and would have to be built once per
(number mode × target × profile). An `exports` map states both, one condition
per consumer. [wp21-packages.md](wp21-packages.md) is the plan of record; it
is rough, and its one hard blocker was that the symbol namespace was flat —
two packages with a private `helper()` each could not be compiled together,
because the whole-program fact table was keyed by symbol name. **That blocker
is closed**: S1 gave every symbol a package scope (wp21 §9), and because the
root package's prefix is empty a single-package program emits the IR it always
did — not one golden moved and no exported name changed. The stage that
follows is S2, bare specifiers and the `nish` export condition; S1 has no
language surface and left `docs/LANGUAGE.md` untouched.

The declaration form is not on that list either, and it is the one entry here
that is pure spelling: **arrow functions become how Nish declares a
function, and `function` becomes legacy**.
[wp22-arrow-functions.md](wp22-arrow-functions.md) is the plan of record. The
change cannot alter a byte of IR — the emitter reads `FunctionSig`s and never
the declaration's syntax kind — so the golden `.ll` files verify the migration
instead of being work it creates, and the two checker rules it needs accept an
arrow without admitting the function values Phase 0 forbids. The order is
forced by the bootstrap: both compilers must accept arrows before `self/` can
be migrated, and `self/` must be arrows before `function` can be rejected.
Stages A and B are cheap and strictly additive; C and D are 1,401 rewrites for
no expressiveness, and are worth taking incrementally — new code in arrows, a
file converted when it is opened for another reason — rather than as a flag day.

The rest of the language surface has no owner either, and a review of the
corpus for the sentence *the language has no X* turned up eight candidates
that belong to nobody: [wp23-language-surface.md](wp23-language-surface.md) is
the plan of record, and its most useful half is the three it **refuses**.
Non-generic `type` aliases and a numeric `enum` have both landed — both were
pure checker work that changed no byte of IR, the alias because `Int32Array`
already establishes that an alias is the type it names, the enum because
`self/` stands 171 module constants in for three of them and nothing stopped
passing a token kind where a node kind belongs. An enum is a *distinct* type
with `i32` representation, so `tests/cases/enum_ir` and `enum_expanded` are one
program written with and without it and their goldens are byte-identical files;
`self/` does not adopt them until the next minor, by the bootstrap seed policy
([wp19-stage0-retirement.md](wp19-stage0-retirement.md) G4). Module-level mutable state is
the one functional gap, since stage1 cannot emit the `--json` object for an
internal compiler error and orientation rule 7 says every failure is one of
those objects; the note designs the narrow version — module-private, scalar,
thread-local by construction — and then argues against building it, because a
boolean parameter costs seven ugly signatures and no proofs while the first
writable global costs a symbol in the flat namespace WP21 has to fix and a row
from WP20's asset table. Pairs and compile-time function parameters are both
deferred to WP18 rather than given syntax of their own, and `for...of` over a
string, a string `switch` and `?.` are declined with the argument written out:
each is refused by a rule the project already accepted, and a plan of record
that says what it turned down is worth more than one that only says yes.

`async`/`await` is the one question on this page whose plan of record is a
**refusal**, and [wp24-async.md](wp24-async.md) is that note. The blocker is
not the lowering, and a coroutine is not a strategy for `async`/`await` but
what `async`/`await` is — the only choice is who writes the state machine, and
both answers were measured. A hand-written coroutine in textual IR is split by
LLVM 18's default pipeline, and when the handle does not escape its caller the
frame, the allocation and both split functions are elided outright, under the
condition `src/codegen/escape.ts` already computes; rustc, meanwhile, uses none
of those intrinsics and builds a 20-byte struct with a one-byte state
discriminant and a `switch`, allocating nothing — which is the shape to copy,
since a struct and a `switch` are constructs this language already has. The
blocker is that there is nothing to await. Every I/O call in the
language is synchronous and there is no socket, timer, sleep or poller in
either compiler or either runtime, so the first deliverable of an async package
would be a poller and a socket type rather than a keyword — a larger package
than the syntax, for a workload nobody has asked for. What an asker usually
wants is one of two things that already have answers: overlapping work is
WP20's threads, and "do not block Node's event loop" is a change to the
generated N-API shim — `napi_create_async_work` plus a promise on the
JavaScript side, with the Nish function left exactly as synchronous as it
is — whose entire cost is WP20's T0 thread-local arena. That one item has no
language surface and is the note's only recommendation to build. The rest is
declined with the rule each refusal breaks, including the tempting one:
accepting `async` as an erased no-op keyword would make a program mean
something different under Node than it does here, in the direction
[wp13-differential.md](wp13-differential.md) exists to prevent. Nothing here
is pre-1.0 — LANGUAGE.md keeps the rejections it has, so M4's freeze is not
waiting on any of it.

The one thing that has *left* the language rather than entered it is
inheritance, and [wp25-inheritance.md](wp25-inheritance.md) is the plan of
record. `extends` gave three things: a field prefix, member reuse, and
polymorphism — and the third is the reason hierarchies exist and the one Nish
never had, because dispatch is static and a vtable is an indirect call the §3a
fact pass cannot see through. So an override reached through a base-typed value
ran the base method natively and the derived one under Node, which was the
language's only knowing disagreement with JavaScript and the only by-design
entry in `known-failures.txt` that was not a number. The removal keeps the half
that was carrying weight by widening `implements` from an exact field match to
a **prefix**: an interface's fields must be the class's first fields, the class
may declare more after them, the conversion is still one `bitcast`, and the
three layout classes that used to be derived are still 24, 16 and 32 bytes with
the C twin unchanged. Two classes with different tails in one `I[]` is the job
`extends` was doing, without a dispatch rule attached. It was affordable
because `self/` — 25,911 lines, the largest Nish program there is — declared no
derived class at all: WP14 §2.1 had already chosen one `Node` class with a
`kind` discriminant over a hierarchy, and Nish-0 was defined as the language
minus "inheritance and downcasts". Sixteen `reject_*` cases collapse into two
rules, both in the checker rather than Phase 0, by the doctrine WP22 §6 states
for a removed spelling.
