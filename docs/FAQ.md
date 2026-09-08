# AmritScript FAQ

Short answers with pointers into the reference. See
[LANGUAGE.md](LANGUAGE.md) for the rules and [ARCHITECTURE.md](ARCHITECTURE.md)
for the machinery.

### Why is there no `any`?

Because every AmritScript value has exactly one fixed LLVM type and memory
layout, decided at compile time. `any` (and `unknown`, unions other than
`T | null`, `typeof`, `instanceof`, prototypes, `eval`, ...) would need
runtime type tags, boxing, and dynamic dispatch, which is what a JavaScript
engine provides and what AmritScript deliberately leaves out. The full list,
with the guarantee each construct would break, is in
[LANGUAGE.md: Forbidden constructs](LANGUAGE.md#forbidden-constructs-phase-0-validator)
and [wp0-validator.md](wp0-validator.md). If it compiles, the layout is
known.

### Why is `number` a 32-bit integer by default?

Loop and index code is the common case in the programs AmritScript targets,
and `i32` is what C and Rust use for it: one machine word, exact, vectorisable,
and the natural type for array indices and exit codes. Treating every
`number` as a double would make `i % 2`, `a[i]`, and `for (let i ...)`
carry conversions and lose exactness above 2^53. The cost is that `number`
does not behave like JavaScript's number: signed integer overflow is
undefined behaviour rather than a wrap, and `1.5` is rejected in i32 mode
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
ahead of time is to avoid that. AmritScript uses one bump-allocated arena
(`runtime/runtime.c`, about 3 KB of machine code): allocation is a load, an
add, a compare and a store inlined into the caller; nothing is freed
individually; the entry wrapper frees everything when `main` returns, and a
C or Node host can call `amrit_reset_arena()` between batches to recycle
memory in O(1). Objects, arrays, and strings built at run time live there;
string literals are constant data. On top of that the compiler places
memory statically ([LANGUAGE.md: Memory model](LANGUAGE.md#memory-model),
[wp6-memory.md](wp6-memory.md)): an object, object literal, or array
literal that provably never leaves its function is an `alloca`, and a
function whose arena temporaries all die with it marks the arena on entry
and releases it before returning, so a hot loop keeps the arena flat.
`Arena.mark()` / `Arena.release(m)` / `Arena.reset()` / `Arena.used()`
give explicit control. Optional reference counting for objects that must
outlive an arena reset is still on the plan; it has not been built.

### How do I keep memory flat in a long-running loop?

Usually by doing nothing: a temporary `new`, `[...]`, or `{ ... }` that does
not escape is a stack slot reused every iteration, and a helper function
whose strings or dynamic arrays die with it gets an automatic arena scope.
Two things defeat that: returning or storing the object (the caller now
owns arena memory), and calling `Arena.reset` / `Arena.release` inside the
callee (the compiler then never scopes it). If a batch does accumulate,
take `const m = Arena.mark()` before it and `Arena.release(m)` after it,
once nothing allocated in between is referenced any more; releasing earlier
is undefined behaviour. `Arena.used()` tells you whether it worked
(`tests/cases/mem_scope_dynamic_array` prints it before and after 100000
calls). `--no-stack-alloc` shows the arena-only IR for comparison.

### What happens on integer division by zero?

The program panics: `attempt to divide by zero` on stderr and exit status
1, and `INT_MIN / -1` (also `%`) panics with `attempt to divide with
overflow`, exactly as Rust does. JavaScript would give `Infinity | 0`,
that is `0`, and C leaves it undefined. The check is two compares and a
branch to a cold block, and LLVM folds it away for constant divisors
([LANGUAGE.md: Checked integer division](LANGUAGE.md#checked-integer-division)).
`f64` division is IEEE: `x / 0` is `Infinity`, `0 / 0` is `NaN`.

### Do integers overflow?

Signed overflow is **undefined behaviour** by default: every user-level
`i32`/`i64` `add`, `sub` and `mul` carries `nsw`, exactly as in C, so LLVM may
widen `i32` loop counters instead of sign-extending them every iteration and
strength-reduce the loops around them.

Code that overflows on purpose — a hash, a linear congruential generator, a
wrap-around counter — must say so, in one of two ways:

- **`--wrapping`** turns the flag off for the whole compilation and restores
  two's-complement wrapping, like a Rust release build: `2147483647 + 1` is
  `-2147483648` again.
- **Write it in an unsigned type.** `u8`, `u16`, `u32` and `u64` are *defined*
  to wrap and never carry a no-wrap flag in either mode, which is what they are
  for; an FNV-1a round in `u32` needs no compiler flag at all.

This is a guarantee earlier versions made and this one withdraws, so it is
worth being blunt: a program that quietly relied on wrapping keeps compiling
and stops being correct. `--wrapping` is the whole remedy
([LANGUAGE.md: Semantics decisions](LANGUAGE.md#semantics-decisions),
[wp15-performance.md](wp15-performance.md)).

### How do I know the compiled program behaves like Node?

`npm run test:diff` compiles every whole program in `tests/cases` and a
50-program corpus, runs each binary, rewrites the same program to
JavaScript using the compiler's own recorded types (`(a + b) | 0` for
`i32`, `BigInt` for `i64`, a bounds-checked index helper, byte lengths),
runs it under Node with `runtime/shim.mjs`, and compares stdout and exit
status byte for byte; `node tests/differential/fuzz.js --count 200`
does the same for random integer programs. Everything that still differs
is listed with a reproducer in
[wp13-differential.md](wp13-differential.md) and
`tests/differential/known-failures.txt`: 1-ulp libm differences in
`sin`/`cos`/`log`/`pow`, `Math.min`/`max` with NaN, `Math.round(-0.3)`,
and the division panics above.

### How do I call AmritScript code from Node?

Two ways, both generated from the same signatures as the IR
([wp8-interop.md](wp8-interop.md)):

- **WebAssembly**: `scripts/build.sh a.ll -o a.wasm --profile wasm` builds a
  freestanding module; `WebAssembly.instantiate` loads it and every exported
  scalar function is callable directly (`examples/node-host.mjs`).
  `--emit-dts a.d.ts` writes the typings and `a.mjs`, a loader that passes
  `Int32Array` / `Float64Array` / `BigInt64Array` arguments by copying them
  into the module's memory (link `runtime/runtime_wasm.c`). Strings are not
  available in this profile because it has no WASI runtime.
- **Native addon**: `--emit-napi a_napi.c` writes an N-API shim,
  `scripts/build.sh a.ll runtime/runtime.c a_napi.c -o a.node --profile napi`
  builds the addon, and `require("./a.node")` loads it
  (`examples/node-addon.mjs`). Numbers, booleans, `i64` (bigint), strings and
  typed arrays are bridged with argument type checks; a typed array is
  borrowed zero-copy, so writes through it are visible in JS.

Design the boundary around batches: one call that processes a whole buffer,
not one call per element. `node bench/ffi.mjs` measures the difference
(about 30 ns per N-API call, 2 ns per wasm call, before any work is done;
0.5 ns per element when a 1M-element `Float64Array` crosses in one call).

### Why not embed a JavaScript engine for npm packages?

Calling npm packages *from* an AmritScript binary would mean embedding a JS
engine (QuickJS adds about 2 MB, V8 tens of MB), marshalling every value
across the boundary at hundreds of cycles per call, and running a second,
garbage-collected heap next to the arena. That erases the reasons to compile
in the first place, so AmritScript deliberately has no such bridge. The
supported direction is the reverse: Node does I/O, HTTP, and npm; AmritScript
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

### Which exit codes does `amritc` use?

`0` success; `1` your program was rejected (or an input path is missing);
`2` usage error (unknown flag, no inputs); `3` toolchain error (`--link`
found no `clang`, or `scripts/build.sh` failed; the `.ll` files are still
written and named); `70` internal compiler error. Details in
[INSTALL.md](INSTALL.md#4-exit-codes) and [wp12-release.md](wp12-release.md#exit-codes-and-failure-modes).

### How do I report a bug?

- **Exit code 70** means the compiler itself crashed, not that your program
  is wrong. It prints `amritc <version>: internal compiler error while
  compiling <files>` and the exception; re-run with `AMRITC_DEBUG=1` for
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

By default the IR is target-neutral (no `target triple` line), so clang
fills in the host triple and warns. It is harmless; `scripts/build.sh`
passes `-Wno-override-module`. `--target host` (or a triple such as
`aarch64-unknown-linux-gnu` or `wasm32-wasi`) writes the `target datalayout`
and `target triple` lines and the warning goes away. Cross-compile with
`--target <triple>` plus `clang --target=<triple>`, or with `llc -mtriple=...`.

### Why does `opt -O2` on my `.ll` not vectorise anything?

Because a target-neutral module gives `opt` a generic data layout with no
vector registers. `--link` is unaffected (clang supplies the layout), but
when you inspect optimised IR by hand compile with `--target host` and
`opt -O2 -S` will vectorise the same loops the binary gets
(`tests/cases/opt_target_triple` is checked for exactly that).

### Why does my function not get `willreturn` / `readnone`?

Because the compiler could not prove it. A `while` loop, a `for` loop that
is not a counted loop, a checked `a[i]`, an integer `/` or `%`
(the divisor check can panic), or a call to `process.exit` drops
`willreturn`; any arena allocation, `console.log`, string concatenation,
field store through a non-stack object, integer division, or `Math.random`
makes the function impure. An object that lives in a stack slot is the
function's own memory, so reading and writing its fields keeps `readnone`
(`tests/cases/mem_stack_struct`, `swapped`). The
exact rules are in
[ARCHITECTURE.md: Attribute soundness rules](ARCHITECTURE.md#attribute-soundness-rules);
the attributes are guarantees, so the compiler never guesses.

### Can I use this on Windows?

Not natively yet: `scripts/build.sh` is bash and the runtime is built with a
POSIX clang. Use WSL with Ubuntu ([INSTALL.md](INSTALL.md#windows)).
