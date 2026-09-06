# StaticTS FAQ

Short answers with pointers into the reference. See
[LANGUAGE.md](LANGUAGE.md) for the rules and [ARCHITECTURE.md](ARCHITECTURE.md)
for the machinery.

### Why is there no `any`?

Because every StaticTS value has exactly one fixed LLVM type and memory
layout, decided at compile time. `any` (and `unknown`, unions other than
`T | null`, `typeof`, `instanceof`, prototypes, `eval`, ...) would need
runtime type tags, boxing, and dynamic dispatch, which is what a JavaScript
engine provides and what StaticTS deliberately leaves out. The full list,
with the guarantee each construct would break, is in
[LANGUAGE.md: Forbidden constructs](LANGUAGE.md#forbidden-constructs-phase-0-validator)
and [wp0-validator.md](wp0-validator.md). If it compiles, the layout is
known.

### Why is `number` a 32-bit integer by default?

Loop and index code is the common case in the programs StaticTS targets,
and `i32` is what C and Rust use for it: one machine word, exact, vectorisable,
and the natural type for array indices and exit codes. Treating every
`number` as a double would make `i % 2`, `a[i]`, and `for (let i ...)`
carry conversions and lose exactness above 2^53. The cost is that `number`
does not behave like JavaScript's number: integer arithmetic wraps and `1.5`
is rejected in i32 mode
([LANGUAGE.md: Semantics decisions](LANGUAGE.md#semantics-decisions)). The
explicit types `i32`, `i64`, and `f64` are always available whatever the
mode.

### How do I get JavaScript number semantics?

Compile with `--number-mode f64`: `number` becomes `double`, literals may be
fractional, `x / 0` is `Infinity`, and `Math.sqrt(n)` works directly on a
`number`. Array indices are truncated toward zero, `.length` is a double, and
`main` must be declared `main(): i32` because the exit code is an integer
(`tests/cases/f64_mode`, `arr_f64`, `math_intrinsics`). In i32 mode you can
mix: `const x: f64 = 1.5` and `Math.sqrt(toF64(n))`. Two things are still
not JavaScript even in f64 mode: `toI32` saturates instead of wrapping
modulo 2^32, and `Math.min`/`max` with a NaN operand return the other operand
([LANGUAGE.md: Builtins](LANGUAGE.md#builtins)).

### Why is there no garbage collector?

A collector needs a runtime that knows where every pointer is, and it costs
binary size, memory, and unpredictable pauses; the whole point of compiling
ahead of time is to avoid that. StaticTS uses one bump-allocated arena
(`runtime/runtime.c`, about 3 KB of machine code): allocation is a load, an
add, a compare and a store inlined into the caller; nothing is freed
individually; the entry wrapper frees everything when `main` returns, and a
C or Node host can call `sts_reset_arena()` between batches to recycle
memory in O(1). Objects, arrays, and strings built at run time live there;
string literals are constant data. WP6 adds stack allocation for objects
that never escape, arena scopes, and opt-in reference counting for objects
that must outlive a reset (see the `TODO(WP6)` markers in the reference).

### How do I call StaticTS code from Node?

Two ways, both generated from the same signatures as the IR
([wp8-interop.md](wp8-interop.md)):

- **WebAssembly**: `scripts/build.sh a.ll -o a.wasm --profile wasm` builds a
  freestanding module; `WebAssembly.instantiate` loads it and every exported
  scalar function is callable directly (`examples/node-host.mjs`).
  `--emit-dts a.d.ts` writes the typings. Strings and arrays are not
  available in this profile because it does not link the C runtime.
- **Native addon**: `--emit-napi a_napi.c` writes an N-API shim,
  `scripts/build.sh a.ll runtime/runtime.c a_napi.c -o a.node --profile napi`
  builds the addon, and `require("./a.node")` loads it
  (`examples/node-addon.mjs`). Scalar functions are bridged with argument
  type checks; string-taking functions are listed as skipped for now.

Design the boundary around batches: one call that processes a whole buffer,
not one call per element. `node bench/ffi.mjs` measures the difference
(about 40 ns per N-API call, 3 ns per wasm call, before any work is done).

### Why not embed a JavaScript engine for npm packages?

Calling npm packages *from* a StaticTS binary would mean embedding a JS
engine (QuickJS adds about 2 MB, V8 tens of MB), marshalling every value
across the boundary at hundreds of cycles per call, and running a second,
garbage-collected heap next to the arena. That erases the reasons to compile
in the first place, so StaticTS deliberately has no such bridge. The
supported direction is the reverse: Node does I/O, HTTP, and npm; StaticTS
does math, parsing, data transforms, and hot loops; they meet once per batch.

### What does an error look like?

Every rejection is one line `file:line:col: error: message` followed by the
source line and a caret marking the offending node, and the process exits
with status 1:

```
tests/cases/reject_type_mismatch.ts:1:40: error: Operator `+` requires two operands of the same numeric type, got i32 and boolean
  1 | function f(a: number): number { return a + true; }
    |                                        ^~~~~~~~
```

Syntax errors use the same layout with `syntax error:`. The compiler stops at
the first error. The message texts are catalogued in
[LANGUAGE.md](LANGUAGE.md#forbidden-constructs-phase-0-validator) and the
format in [wp10-ci.md](wp10-ci.md#diagnostic-format).

### Which exit codes does `statictsc` use?

`0` success; `1` your program was rejected (or an input path is missing);
`2` usage error (unknown flag, no inputs); `3` toolchain error (`--link`
found no `clang`, or `scripts/build.sh` failed; the `.ll` files are still
written and named); `70` internal compiler error. Details in
[INSTALL.md](INSTALL.md#4-exit-codes) and [wp12-release.md](wp12-release.md#exit-codes-and-failure-modes).

### How do I report a bug?

- **Exit code 70** means the compiler itself crashed, not that your program
  is wrong. It prints `statictsc <version>: internal compiler error while
  compiling <files>` and the exception; re-run with `STATICTSC_DEBUG=1` for
  the stack trace, then open an issue at
  <https://github.com/amritk/compiler/issues> with the input file, the
  command line, and that output.
- **Wrong IR or wrong native output** for a program that compiles: attach
  the `.ts`, the `.ll` (`-o out.ll`), the flags, and what you expected.
  `--plain` gives the smallest IR to look at. Behaviour that is known to
  disagree with JavaScript or the design notes is listed in
  [LANGUAGE.md: Known inconsistencies](LANGUAGE.md#known-inconsistencies);
  check there first.
- **A rejection you think is wrong**: quote the full three-line diagnostic.
  The reference marks every rule with the test case that fixes it, so a
  report can point at the rule.

### Why does clang warn about "overriding the module target triple"?

The IR is target-neutral (no `target triple` line), so clang fills in the
host triple and warns. It is harmless; `scripts/build.sh` passes
`-Wno-override-module`. Cross-compile with `llc -mtriple=...` or
`clang --target=...`.

### Why does my function not get `willreturn` / `readnone`?

Because the compiler could not prove it. A `while` loop, a `for` loop that
is not a counted loop, a `throw`, a checked `a[i]`, or a call to
`process.exit` drops `willreturn`; any allocation, `console.log`, string
concatenation, field store, or `Math.random` makes the function impure. The
exact rules are in
[ARCHITECTURE.md: Attribute soundness rules](ARCHITECTURE.md#attribute-soundness-rules);
the attributes are guarantees, so the compiler never guesses.

### Can I use this on Windows?

Not natively yet: `scripts/build.sh` is bash and the runtime is built with a
POSIX clang. Use WSL with Ubuntu ([INSTALL.md](INSTALL.md#windows)).
