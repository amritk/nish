# AmritScript Master Plan

The single source of truth for what AmritScript is, what exists, what remains,
and how the remaining work is cut into packages that independent agents can
build in parallel. Every work package (WP) below is self-contained: goal,
scope, files, dependencies, acceptance tests, and a ready-to-use agent brief.

Repo: `amritk/compiler`, branch `claude/llvm-ir-typescript-compiler-hf5pxr`.

---

## 1. Vision

AmritScript is an ahead-of-time compiler for a strictly static subset of
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
4. **Node/npm interop in one direction only.** AmritScript exports `.wasm` /
   native addons that Node imports. AmritScript never embeds a JS engine.

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
│    Phase B  checker.ts     AmritScript types, scopes, side tables   │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. Compiler backend                                              │
│    Phase C  codegen/attributes.ts  purity / escape / loop facts  │
│             codegen/emitter.ts     AST -> LLVM IR text           │
│             codegen/runtime.ts     runtime ABI, inline allocator │
│    runtime/runtime.c               arena + strings (C, ~1 KB)    │
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
- **Runtime stays tiny.** Budget: `runtime.c` under 8 KB source, under 4 KB
  compiled at `-Oz`. No stdio on hot paths.

## 3. Consolidated language specification (AmritScript)

### 3.1 Types

| AmritScript | LLVM | Notes |
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
`T | null`, generics (until a monomorphisation WP exists), `symbol`,
`bigint`, regex literals, `try`/`catch` and `throw` (no unwinding; a failure is a `Result<T, E>`, WP16).

### 3.3 Semantics decisions already made

- Integer overflow wraps (Rust release semantics). Revisit under WP9.
- Strings are immutable and shared by pointer; equality is by content.
- Functions are `nounwind`; there is no `throw` (WP16), and `panic(message)` prints and exits 1.
- Parameters are immutable (`const` semantics) and used as SSA values.
- Locals use `alloca`/`load`/`store` with natural alignment; `opt -mem2reg`
  promotes them, so this is free.
- All top-level functions are exported with C ABI unless a future
  `--strict-exports` makes non-`export` functions `internal`.

### 3.4 Open decisions (need an owner, do not block Wave 1)

| Question | Options | Recommendation |
| --- | --- | --- |
| Default `number` mode | `i32` (fast, current) vs `f64` (JS semantics) | Keep `i32` default; document loudly; `f64` via flag or per-file pragma. |
| Overflow | wrap / trap / `nsw` UB | Wrap now; `--overflow-checks` trap mode later (WP9). |
| Class inheritance | none / single with prefix layout / interfaces only | Single inheritance via struct prefix, no virtual dispatch until needed. |
| Object lifetime | arena only / arena + RC / escape-analysed stack | Arena + escape-analysed `alloca` (WP6); RC opt-in per class. |
| String encoding | UTF-8 bytes (current) vs UTF-16 (JS) | UTF-8; `.length` is byte length, documented. |

## 4. What exists today

| Area | State | Files |
| --- | --- | --- |
| Parser | done | `src/parser.ts` |
| Checker: functions, params, locals, arithmetic, comparisons, calls, returns | done | `src/checker.ts` |
| Emitter: SSA temps, alloca locals, binary ops, calls, i32/f64 modes | done | `src/codegen/emitter.ts`, `ir.ts` |
| Attributes: nounwind, willreturn, readnone/readonly fixpoint, noundef, zeroext, string noalias/nonnull/readonly/nocapture escape analysis, align | done | `src/codegen/attributes.ts` |
| Runtime: chunked arena, O(1) reset, strings (new/concat/eq/len/print/from_i32/from_f64) | done | `runtime/runtime.c` |
| Inline `alwaysinline` bump allocator in IR, ABI declarations | done | `src/codegen/runtime.ts` |
| Build profiles debug/speed/size/wasm, size report | done | `scripts/build.sh`, `scripts/size-report.sh` |
| Node imports wasm module | done | `examples/node-host.mjs` |
| Tests: golden IR, llvm-as, clang round trip, runtime unit test, IR/C layout smoke, size + wasm builds, negatives | done | `tests/run.js` |
| CLI: `-o`, `--number-mode`, `--plain`, `--runtime-decls` | done | `src/index.ts` |

Measured: add.ts + runtime + C driver = 4.5 KB stripped native, 279 B wasm.

## 5. Work packages

Sizes: S = under a day of agent work, M = one to two days, L = several days.
"Parallel-safe" means the WP mostly adds files rather than editing the shared
`checker.ts`/`emitter.ts` hot spots (see WP-P).

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

- `src/validator.ts`: `validateAmritScript(sourceFile)` walks the whole tree
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
- Runtime: `sts_abort(msg)` for `throw`.

Acceptance: goldens for each construct; native round trips for fib, gcd,
collatz, nested loops; `opt -O2` output vectorises a simple sum loop
(check for `<4 x i32>` in `opt -O2 -S`); Rust/C comparison benchmark for
fib(35) within 10 % (WP9 formalises the harness, a quick `hyperfine` run is
enough here).

### WP2: Classes, interfaces, structs (L, depends on WP1 for methods with loops)

Goal: `class` and `interface` as LLVM struct types with fixed fields.

- `%struct.User = type { i32, double }`; field order as declared; natural
  alignment; `align 8` on allocations.
- `new User(...)` lowers to the inline `sts_alloc_struct` (size from
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
- `a + b` on strings lowers to `sts_str_concat`; `a === b` to `sts_str_eq`;
  `s.length` to a direct `load i64` from the header (no call).
- Template literals: fold constant parts, `sts_str_from_i32/f64` for holes,
  chain concat (or a `sts_str_concat_n` runtime addition).
- `console.log(x)` accepts string, number, boolean; lowers to `sts_print`.
- Number to string: `sts_str_from_f64` must match JS `Number.prototype.toString`
  (shortest round-trip). Port Ryu or Grisu-style shortest formatting to
  `runtime.c` within budget, or accept `%.17g` and document until WP7.
- Mark functions that only call `sts_str_len` as `readonly` (already
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
  `sts_abort("index out of range")` block; `--unchecked-indexing` flag
  removes it for benchmarks.
- `.length`, `for (const x of arr)`, `for` with index; `push` deferred
  (needs growth strategy; arena realloc doubling is fine).
- Typed views for interop: `Int32Array`/`Float64Array` map to the same
  layout so Node can pass buffers (WP8).

Acceptance: goldens; native round trip summing an array and sorting one
(insertion sort in AmritScript); bounds failure exits non-zero with message;
`opt -O2` vectorises the sum loop with checks hoisted or removed.

### WP5: Modules, entry point, linkage (M, parallel-safe)

Goal: multi-file programs and runnable binaries without a hand-written C driver.

- `export function` keeps external linkage; non-exported functions become
  `internal` under `--strict-exports` (default stays external for now).
- `import { f } from "./other"`: compile each file to its own `.ll`, emit
  `declare` for imported symbols with the same attributes the exporter
  computed (write a `.d.sts.json` sidecar with signatures and attributes),
  link them with `build.sh`. Cycles are allowed at link time.
- `export function main(): number` becomes the process entry: emit
  `@main` wrapper that initialises nothing (arena is lazy), calls user
  `main`, calls `sts_free_arena`, returns the code. Process args exposed
  later (WP7).
- CLI: `amritc a.ts b.ts -o out/` and `amritc --link a.ts b.ts -o app`
  which shells out to `scripts/build.sh`.

Acceptance: two-file example builds and runs with `amritc --link`;
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
  `sts_arena_mark()` / `sts_arena_release(mark)`.
- Optional reference counting per class (`@refcounted` decorator or
  `class X extends Rc`): 8-byte header, `sts_rc_retain/release`, release
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

- `amritc --emit-header` writes a C header for exported functions and
  structs from the same signature data the emitter uses.
- `amritc --emit-dts` writes `.d.ts` for the wasm exports (scalars now,
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
  struct-heavy loop; each in AmritScript, C, and Rust; `hyperfine` runner and
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

- `docs/LANGUAGE.md`: the normative AmritScript reference (from §3, kept in
  sync by every WP that adds a construct).
- `docs/IR_COOKBOOK.md`: for each construct, the `.ts` and the exact `.ll`.
- README stays the tour; deep material moves to `docs/`.

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

| Wave | Packages | Parallelism |
| --- | --- | --- |
| 0 | WP-P | one agent, lands first |
| 1 | WP0, WP1, WP3, WP5, WP7, WP10 | six agents, disjoint files after WP-P |
| 2 | WP2, WP4 (WP4 starts once WP2 fixes layout rules), WP8 | three agents |
| 3 | WP6, WP9, WP2b | three agents |
| always | WP11 | folded into each WP's definition of done |

Merge order inside a wave: smallest diff first (WP0, WP10), then WP3/WP5/WP7,
then WP1. Each agent rebases on the branch head before pushing.

## 7. Conventions for every agent

1. Work on `claude/llvm-ir-typescript-compiler-hf5pxr` in a sub-branch
   `wp<N>/<short-name>`; open a PR into the main feature branch.
2. `npm test` must be green, and every new construct needs: a golden `.ll`,
   an `llvm-as` pass, a native round trip with expected stdout, and at least
   one negative test. Run `opt -passes=verify` on every emitted module.
3. Do not emit an attribute you cannot cite a checker proof for. Write the
   reason in `attributes.ts` alongside the code.
4. Any change to a struct layout touches `runtime.ts` and `runtime.c` in
   the same commit and adds/extends a layout smoke test.
5. Keep `runtime.c` within budget (§2). Report its size in the PR.
6. Update `docs/LANGUAGE.md` and the IR cookbook for what you added.
7. Commit messages: imperative subject, body explaining the lowering.
   No model names in commits, code, or PR text.
8. Never widen scope into another WP's files; leave a TODO referencing the
   WP number instead.

## 8. Agent brief template

```
You are implementing <WP-N: title> for AmritScript, a TypeScript-to-LLVM-IR AOT
compiler. Read docs/MASTER_PLAN.md (§2 design rules, §3 spec, §5 your WP,
§7 conventions) and README.md first. Run `npm test` before changing anything.

Scope: <paste the WP bullet list>.
Out of scope: <neighbouring WPs>.
Files you own: <list>. Files you may read but not edit: <list>.

Definition of done:
- <acceptance criteria from §5>
- `npm test` green, new goldens under tests/cases/, docs updated.
- Push to branch wp<N>/<name> and open a PR into
  claude/llvm-ir-typescript-compiler-hf5pxr with the IR for each new
  construct shown in the PR body.

Show the exact LLVM IR for every TypeScript snippet you add to the tests.
```

## 9. Milestones

| Milestone | Contents | Proof |
| --- | --- | --- |
| M1 "Programs" | WP-P, WP0, WP1, WP3, WP5, WP10 | fib/gcd/string CLI builds with `amritc --link`, under 20 KB. |
| M2 "Data" | WP2, WP4, WP7 | nbody with structs and arrays, matches C output bit for bit. |
| M3 "Rust parity" | WP6, WP9, WP8 | benchmark table within 10 % of Rust; wasm and N-API demos. |
| M4 "1.0" | WP2b, remaining docs, stabilised spec | tagged release, language reference frozen. |
| M5 "Self-hosting" | WP14 ([wp14-selfhost.md](wp14-selfhost.md)) | `self/` compiles `self/`: `IR(stage1, self/) == IR(stage2, self/)` byte for byte, and stage3 is byte-identical to stage2 (`tests/self/bootstrap.js`). |
