/**
 * Nish builtins, host-agnostic (WP13 differential testing, WP33 R3).
 *
 * The differential runner (tests/differential/run.js) rewrites an Nish
 * program into plain JavaScript and runs it under Node with this module as
 * `__nish` (`runtime/shim.mjs`, which is this core with `runtime/node.mjs`
 * installed as its host). Every helper here reproduces the *runtime* semantics the compiled
 * binary has (runtime/runtime.c and runtime/runtime-os.c, the system-call half,
 * plus the intrinsics in docs/wp7-runtime.md) where JavaScript's own semantics
 * differ:
 *
 *   - `number` is a 32-bit integer in the default mode (`--number-mode i32`),
 *     `i64` is a 64-bit integer, both wrapping; JS has doubles and BigInt.
 *   - `u8`/`u16`/`u32`/`u64` are unsigned and wrapping, and JavaScript has no
 *     unsigned integers at all: the narrow three live in a `number` masked
 *     back into range (`& 0xFF`, `& 0xFFFF`, `>>> 0`) and `u64` is a BigInt
 *     kept in range with `BigInt.asUintN(64, x)`.
 *   - `f32` is a 32-bit float and JavaScript has only doubles, so every `f32`
 *     result is rounded with `Math.fround`.
 *   - `s.length` is the UTF-8 byte length, and so is every index the string
 *     methods take or return: `charCodeAt` yields a byte (and bounds-checks
 *     instead of returning `NaN`), `substring` cuts on byte offsets, and
 *     `indexOf` answers with one. `slice` cuts on byte offsets too and panics
 *     on a range the string does not contain, where JavaScript would clamp and
 *     read a negative offset from the end. `String.fromCharCode` builds a
 *     one-byte string from the low 8 bits, and `String.fromBytes` one such
 *     string per byte of its range.
 *   - `a[i]` is bounds-checked: out of range prints
 *     `index out of range: <i> >= <len>` to stderr and exits 1, and so is
 *     `a.pop()` on an empty array, which has no `undefined` to return.
 *   - `toI32/toI64` from f64 saturate (NaN -> 0), integer conversions wrap.
 *   - `console.log(x)` never prints the `n` suffix of an i64 and writes
 *     synchronously so `process.exit` cannot lose output.
 *   - file I/O errors print `nish: cannot read <path>` and exit 1.
 *   - a directory listing is sorted by UTF-8 bytes, which is `strcmp`'s order
 *     and not `Array#sort`'s UTF-16 one; `monotonicNanos` reads a clock whose
 *     origin is arbitrary, so two readings can agree with a native run and a
 *     single reading never can.
 *   - `process.argv[0]` is the program (the script here, the executable
 *     natively); `parseInt` is base 10 only and saturates into i32 (0 for no
 *     digits); `parseFloat`/`Number` accept ASCII whitespace, decimal forms,
 *     `Infinity`, and a `0x` hex prefix (parseFloat too, unlike JS).
 *
 * The core names no `node:` module and neither `process` nor `Buffer`: what it
 * needs of the world goes through the host `runtime/core/host.mjs` holds, so
 * another adapter can stand where `runtime/node.mjs` stands. A check in
 * `tests/run.js` (`runtime-hosts`) holds it to that.
 *
 * The rewrite rules that call these helpers are listed in docs/wp13-differential.md.
 */
export * from "./core/arrays.mjs";
export * from "./core/host.mjs";
export * from "./core/numbers.mjs";
export * from "./core/result.mjs";
export * from "./core/strings.mjs";
