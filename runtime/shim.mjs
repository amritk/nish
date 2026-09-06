/**
 * StaticTS builtins for Node (WP13 differential testing).
 *
 * The differential runner (tests/differential/run.js) rewrites a StaticTS
 * program into plain JavaScript and runs it under Node with this module as
 * `__sts`. Every helper here reproduces the *runtime* semantics the compiled
 * binary has (runtime/runtime.c plus the intrinsics in docs/wp7-runtime.md)
 * where JavaScript's own semantics differ:
 *
 *   - `number` is a 32-bit integer in the default mode (`--number-mode i32`),
 *     `i64` is a 64-bit integer, both wrapping; JS has doubles and BigInt.
 *   - `s.length` is the UTF-8 byte length.
 *   - `a[i]` is bounds-checked: out of range prints
 *     `index out of range: <i> >= <len>` to stderr and exits 1.
 *   - `toI32/toI64` from f64 saturate (NaN -> 0), integer conversions wrap.
 *   - `console.log(x)` never prints the `n` suffix of an i64 and writes
 *     synchronously so `process.exit` cannot lose output.
 *   - `throw` traps (`llvm.trap` -> SIGILL) instead of unwinding.
 *   - file I/O errors print `statictsc: cannot read <path>` and exit 1.
 *   - `process.argv[0]` is the program (the script here, the executable
 *     natively); `parseInt` is base 10 only and saturates into i32 (0 for no
 *     digits); `parseFloat`/`Number` accept ASCII whitespace, decimal forms,
 *     `Infinity`, and a `0x` hex prefix (parseFloat too, unlike JS).
 *
 * The rewrite rules that call these helpers are listed in docs/wp13-differential.md.
 */
import fs from "node:fs";

const I32_MIN = -2147483648;
const I32_MAX = 2147483647;
const I64_MIN = -(1n << 63n);
const I64_MAX = (1n << 63n) - 1n;

/** `trunc i64 -> i32` (wrap) for BigInt, `llvm.fptosi.sat.i32.f64` for numbers. */
export function toI32(x) {
  if (typeof x === "bigint") return Number(BigInt.asIntN(32, x));
  if (Number.isNaN(x)) return 0;
  if (x >= I32_MAX) return I32_MAX;
  if (x <= I32_MIN) return I32_MIN;
  return Math.trunc(x) | 0;
}

/** `sext i32 -> i64` for int32 numbers, `llvm.fptosi.sat.i64.f64` for doubles. */
export function toI64(x) {
  if (typeof x === "bigint") return x;
  if (Number.isNaN(x)) return 0n;
  if (x >= 9223372036854775808) return I64_MAX;
  if (x <= -9223372036854775808) return I64_MIN;
  return BigInt(Math.trunc(x));
}

/** `sitofp` for both integer widths; a double is returned unchanged. */
export function toF64(x) {
  return typeof x === "bigint" ? Number(x) : x;
}

/**
 * `f64ToBits` / `bitsToF64`: reinterpret the 64 bits, never convert the value.
 * The compiler lowers each to one `bitcast`; here it is a one-element
 * DataView, which is the only way JavaScript lets you see a double's bits.
 * The result is signed, matching the i64 the compiler produces.
 */
const BITS = new DataView(new ArrayBuffer(8));

export function f64ToBits(x) {
  BITS.setFloat64(0, x);
  return BigInt.asIntN(64, BITS.getBigUint64(0));
}

export function bitsToF64(b) {
  BITS.setBigInt64(0, BigInt.asIntN(64, b));
  return BITS.getFloat64(0);
}

/** Wrap a BigInt to the i64 range: every i64 `+ - * /` and unary minus goes through here. */
export function wrapI64(x) {
  return BigInt.asIntN(64, x);
}

/**
 * The i64 shifts. BigInt has no `>>>` and neither of its shifts masks the
 * count, so all three do here what `codegen/emit/bitwise.ts` emits: mask the
 * count to 6 bits, then shift. `lshrI64` reads the operand as unsigned before
 * shifting and hands back the signed reading of the result, which is `lshr`.
 */
export function shlI64(a, b) {
  return BigInt.asIntN(64, a << (b & 63n));
}
export function ashrI64(a, b) {
  return a >> (b & 63n);
}
export function lshrI64(a, b) {
  return BigInt.asIntN(64, BigInt.asUintN(64, a) >> (b & 63n));
}

/** `llvm.abs.i64(x, false)`: the minimum value wraps to itself. */
export function absI64(x) {
  return BigInt.asIntN(64, x < 0n ? -x : x);
}

/** `llvm.smin.i64` / `llvm.smax.i64` (Math.min/max reject BigInt). */
export function minI64(a, b) {
  return a < b ? a : b;
}
export function maxI64(a, b) {
  return a > b ? a : b;
}

/** `s.length`: UTF-8 byte length for strings (arrays keep their own `.length`). */
export function strLen(x) {
  return typeof x === "string" ? Buffer.byteLength(x, "utf8") : x.length;
}

/** `console.log(x)`: `String(x)` (no `n` suffix for i64) plus a newline, written synchronously. */
export function log(x) {
  fs.writeSync(1, `${String(x)}\n`);
}

/** Index conversion as in the compiler: `sext` from i32, `fptosi` (truncation) from f64. */
function toIndex(i) {
  return typeof i === "bigint" ? Number(i) : Math.trunc(i);
}

function panicIndex(i, len) {
  fs.writeSync(2, `index out of range: ${i} >= ${len}\n`);
  process.exit(1);
}

/** `a[i]` read with the WP4 bounds check (negative indices fail like the unsigned compare does). */
export function idx(a, i) {
  const k = toIndex(i);
  if (!(k >= 0 && k < a.length)) panicIndex(k, a.length);
  return a[k];
}

/** `a[i] = v`: evaluates `a`, `i`, `v`, then checks and stores; yields `v`. */
export function setIdx(a, i, v) {
  const k = toIndex(i);
  if (!(k >= 0 && k < a.length)) panicIndex(k, a.length);
  a[k] = v;
  return v;
}

/** `a[i] op= v`: evaluates `a`, `i`, checks, loads, then `f(old)` computes the new element. */
export function updIdx(a, i, f) {
  const k = toIndex(i);
  if (!(k >= 0 && k < a.length)) panicIndex(k, a.length);
  const v = f(a[k]);
  a[k] = v;
  return v;
}

/** `new Array<T>(n)`: `n` zero-filled elements (`0`, `0n`, or `false`). */
export function newArray(n, zero) {
  return new Array(toIndex(n)).fill(zero);
}

/** `process.exit(code)`: libc `exit` truncates to 8 bits exactly like Node does. */
export function exit(code) {
  process.exit(toIndex(code));
}

/** `throw`: `llvm.trap` kills the native binary with SIGILL; do the same here. */
export function trap() {
  process.kill(process.pid, "SIGILL");
  // A signal handler could intercept SIGILL; never fall through into the rest of the program.
  process.exit(132);
}

function ioFail(verb, path) {
  fs.writeSync(2, `statictsc: cannot ${verb} ${path}\n`);
  process.exit(1);
}

export function readFileSync(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    return ioFail("read", path);
  }
}

export function writeFileSync(path, data) {
  try {
    fs.writeFileSync(path, data, "utf8");
  } catch {
    ioFail("write", path);
  }
}

export function appendFileSync(path, data) {
  try {
    fs.appendFileSync(path, data, "utf8");
  } catch {
    ioFail("write", path);
  }
}

/** `process.argv`: index 0 is the program (the script here, the executable natively), then the arguments. */
export function argv() {
  return process.argv.slice(1);
}

const SPACES = "[ \\t\\n\\v\\f\\r]*";
/** What `sts_parse_number` recognises: strtod's decimal and hex-integer forms, or an exact `Infinity`. */
const LITERAL = new RegExp(`^${SPACES}([+-]?)(Infinity|0[xX][0-9a-fA-F]+|(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)`);
const BLANK = new RegExp(`^${SPACES}$`);
const WHOLE = new RegExp(`${LITERAL.source}${SPACES}$`);

/** The value of a `LITERAL` match: hex goes through parseInt(16), and `-` applies afterwards as in strtod. */
function literalValue(m) {
  const magnitude = /^0[xX]/.test(m[2]) ? Number.parseInt(m[2], 16) : Number(m[2]);
  return m[1] === "-" ? -magnitude : magnitude;
}

/** `parseInt(s)`: strtoll base 10 (ASCII whitespace, sign, digits; 0 without digits) saturated into i32. */
export function parseInt(s) {
  const m = new RegExp(`^${SPACES}([+-]?\\d+)`).exec(s);
  return m ? toI32(Number(m[1])) : 0;
}

/** `parseFloat(s)`: the longest literal after ASCII whitespace, else NaN (`0x1A` is 26, as strtod reads it). */
export function parseFloat(s) {
  const m = LITERAL.exec(s);
  return m ? literalValue(m) : NaN;
}

/** `Number(x)`: a string must be one literal bar surrounding ASCII whitespace (blank is 0); others convert numerically. */
export function number(x) {
  if (typeof x === "bigint") return Number(x);
  if (typeof x === "boolean") return x ? 1 : 0;
  if (typeof x !== "string") return x;
  const m = WHOLE.exec(x);
  if (m) return literalValue(m);
  return BLANK.test(x) ? 0 : NaN;
}

// Arena introspection has no JS counterpart: the stubs keep programs that only
// compare `Arena.used()` before/after (a "stayed flat" check) in agreement, while
// programs that print raw byte counts are listed as known differences.
export function arenaUsed() { return 0; }
export function arenaMark() { return 0; }
export function arenaRelease() {}
export function arenaReset() {}
