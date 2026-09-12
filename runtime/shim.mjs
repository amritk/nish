/**
 * Nish builtins for Node (WP13 differential testing).
 *
 * The differential runner (tests/differential/run.js) rewrites an Nish
 * program into plain JavaScript and runs it under Node with this module as
 * `__nish`. Every helper here reproduces the *runtime* semantics the compiled
 * binary has (runtime/runtime.c and runtime/runtime_os.c, the system-call half,
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
 *     `indexOf` answers with one. `String.fromCharCode` builds a one-byte
 *     string from the low 8 bits.
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
 * The rewrite rules that call these helpers are listed in docs/wp13-differential.md.
 */
import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";

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

// ---- Unsigned integers (WP15) -------------------------------------------------------
//
// JavaScript has no unsigned integer type, so every unsigned result is masked
// back into its width right where the compiled code would have relied on the
// LLVM type. u8/u16/u32 fit a `number` exactly (2^32 - 1 < 2^53); u64 is a
// BigInt, so it goes through `wrapU64` the way i64 goes through `wrapI64`.

/** Wrap into the u64 range: every u64 `+ - * /`, unary minus and shift ends here. */
export function wrapU64(x) {
  return BigInt.asUintN(64, x);
}

/**
 * The u64 shifts. A u64 is already held as a non-negative BigInt, so its `>>`
 * *is* the logical shift; what these add over the operator is the count mask
 * (BigInt does not mask) and the wrap back into the unsigned range.
 */
export function shlU64(a, b) {
  return BigInt.asUintN(64, a << (b & 63n));
}
export function lshrU64(a, b) {
  return BigInt.asUintN(64, a) >> (b & 63n);
}

/**
 * The widths, as the rewriter names them. `bits` drives every mask and
 * `BigInt.asIntN`/`asUintN` call; `big` says whether the value is a BigInt
 * (i64/u64) or a `number` in JavaScript.
 */
const INT_KINDS = {
  i32: { bits: 32, signed: true, big: false },
  i64: { bits: 64, signed: true, big: true },
  u8: { bits: 8, signed: false, big: false },
  u16: { bits: 16, signed: false, big: false },
  u32: { bits: 32, signed: false, big: false },
  u64: { bits: 64, signed: false, big: true },
};

/** `llvm.umin`/`umax` on u64 (`Math.min`/`max` reject BigInt); the u32-and-below widths use Math. */
export function minU64(a, b) {
  return a < b ? a : b;
}
export function maxU64(a, b) {
  return a > b ? a : b;
}

/**
 * Every numeric conversion whose source or target is unsigned (`toU8`,
 * `toU32(i)`, `toI32(u)`, ...), as one function taking the kind names the
 * checker recorded. Doing it through BigInt is what makes the whole matrix
 * exact in one place: an integer source is turned into its true mathematical
 * value, then `asIntN`/`asUintN` performs the sign-extend, zero-extend or
 * truncate that the target's width and signedness call for — which is exactly
 * what `sext`/`zext`/`trunc` do natively.
 */
export function convert(x, from, to) {
  const num = typeof x === "bigint" ? Number(x) : x;
  if (to === "f64") return num; // sitofp / uitofp / fpext
  if (to === "f32") return Math.fround(num); // ... / fptrunc, then rounded to a float
  const target = INT_KINDS[to];
  const lo = target.signed ? -(1n << BigInt(target.bits - 1)) : 0n;
  const hi = target.signed ? (1n << BigInt(target.bits - 1)) - 1n : (1n << BigInt(target.bits)) - 1n;
  let exact;
  if (INT_KINDS[from] === undefined) {
    // A float source (f32 or f64) goes through the saturating intrinsics: NaN
    // is 0 and out-of-range values clamp. The bounds are BigInt because
    // 2^64 - 1 has no exact `number`.
    if (Number.isNaN(x)) exact = 0n;
    else if (x <= Number(lo)) exact = lo;
    else if (x >= Number(hi)) exact = hi;
    else exact = BigInt(Math.trunc(x));
  } else {
    exact = BigInt(x); // sext/zext/trunc, below
  }
  const wrapped = target.signed ? BigInt.asIntN(target.bits, exact) : BigInt.asUintN(target.bits, exact);
  return target.big ? wrapped : Number(wrapped);
}

/** `s.length`: UTF-8 byte length for strings (arrays keep their own `.length`). */
export function strLen(x) {
  return typeof x === "string" ? Buffer.byteLength(x, "utf8") : x.length;
}

/** The UTF-8 bytes of `s`, which is what an Nish string holds. */
function bytesOf(s) {
  return Buffer.from(s, "utf8");
}

/** `s.charCodeAt(i)`: the byte at `i`, bounds-checked as `a[i]` is (JavaScript answers NaN). */
export function charCodeAt(s, i) {
  const bytes = bytesOf(s);
  const k = toIndex(i);
  if (!(k >= 0 && k < bytes.length)) panicIndex(k, bytes.length);
  return bytes[k];
}

/** `s.substring(a, b)`: JavaScript's clamp and swap, over byte offsets. */
export function substring(s, a, b) {
  const bytes = bytesOf(s);
  const clamp = (v) => Math.max(0, Math.min(toIndex(v), bytes.length));
  const from = clamp(a);
  const to = b === undefined ? bytes.length : clamp(b);
  return bytes.subarray(Math.min(from, to), Math.max(from, to)).toString("utf8");
}

/** `s.indexOf(sub)`: the first *byte* offset, or -1. */
export function indexOf(s, sub) {
  return bytesOf(s).indexOf(bytesOf(sub));
}

/** `nish_str_at`: whether `sub`'s bytes sit at byte offset `at`. */
function occursAt(s, at, sub) {
  const bytes = bytesOf(s);
  const needle = bytesOf(sub);
  return at >= 0 && at + needle.length <= bytes.length && bytes.subarray(at, at + needle.length).equals(needle);
}

export function startsWith(s, sub) {
  return occursAt(s, 0, sub);
}

export function endsWith(s, sub) {
  return occursAt(s, bytesOf(s).length - bytesOf(sub).length, sub);
}

/** `String.fromCharCode(c)`: the one-byte string of `c & 0xFF`. */
export function fromCharCode(code) {
  return Buffer.from([toIndex(code) & 0xff]).toString("latin1");
}

/** `console.log(x)`: `String(x)` (no `n` suffix for i64) plus a newline, written synchronously. */
export function log(x) {
  fs.writeSync(1, `${String(x)}\n`);
}

/** `console.error(x)`: the same, on stderr. */
export function error(x) {
  fs.writeSync(2, `${String(x)}\n`);
}

/** `write(s)` / `writeError(s)`: the bytes as they are, no trailing newline. */
export function write(s) {
  fs.writeSync(1, s);
}

export function writeError(s) {
  fs.writeSync(2, s);
}

/** `panic(message)`: the message on stderr, then exit 1. */
export function panic(message) {
  fs.writeSync(2, `${message}\n`);
  process.exit(1);
}

// ---- Result (WP16) ---------------------------------------------------------
//
// Natively a `Result` is a two-arm struct in the arena; here it is an ordinary
// object with the same three names, so `r.ok`, `r.value` and `r.error` in the
// rewritten program mean what they mean in the compiled one. Only `orReturn`
// needs help: it returns from the *enclosing* function, which no expression in
// JavaScript can do, so it throws a sentinel that `rewrite.js` catches in a
// wrapper around every body that contains one.

class Propagate {
  constructor(error) {
    this.error = error;
  }
}

class NishResult {
  constructor(ok, value, error) {
    this.ok = ok;
    if (ok) this.value = value;
    else this.error = error;
  }
  isOk() {
    return this.ok;
  }
  isErr() {
    return !this.ok;
  }
  unwrapOr(fallback) {
    return this.ok ? this.value : fallback;
  }
  expect(message) {
    if (this.ok) return this.value;
    panic(message);
  }
  orReturn() {
    if (this.ok) return this.value;
    throw new Propagate(this.error);
  }
}

/** `Ok(v)`; `Ok()` on a `Result<void, E>` carries nothing. */
export function Ok(value) {
  return new NishResult(true, value, undefined);
}

/** `Err(e)`. */
export function Err(error) {
  return new NishResult(false, undefined, error);
}

/**
 * The `catch` half of `orReturn`: re-raise anything that is not a propagation,
 * and answer the `Err` the enclosing function should return otherwise. The
 * rewriter emits `return __nish.caught(e)` and nothing else, so a genuine
 * runtime error still reaches Node unchanged.
 */
export function caught(thrown) {
  if (thrown instanceof Propagate) return new NishResult(false, undefined, thrown.error);
  throw thrown;
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

/** `a.pop()`: the last element, or the bounds panic — Nish has no `undefined` to return. */
export function pop(a) {
  if (a.length === 0) panicIndex(0, 0);
  return a.pop();
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


function ioFail(verb, path) {
  fs.writeSync(2, `nish: cannot ${verb} ${path}\n`);
  process.exit(1);
}

export function readFileSync(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    return ioFail("read", path);
  }
}

/** `readFileSyncOrNull(path)`: null instead of exiting, so the program decides. */
export function readFileSyncOrNull(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    return null;
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

/**
 * `mkdirSync(path)` (WP14 D4): one directory, not recursive, answering whether
 * a directory is there afterwards. Node throws where the runtime answers
 * false, and `EEXIST` on a plain file is a failure here as it is there, so the
 * `statSync` decides rather than the exception.
 */
export function mkdirSync(path) {
  try {
    fs.mkdirSync(path);
    return true;
  } catch {
    try {
      return fs.statSync(path).isDirectory();
    } catch {
      return false;
    }
  }
}

/**
 * `isDirectorySync(path)` (WP14 §7a): one stat, and a boolean out of it rather
 * than an exception, which is what the runtime's `stat` answers too.
 */
export function isDirectorySync(path) {
  try {
    return fs.statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * `readdirSync(path)`: the entries, sorted ascending by bytes, or `null` when
 * the directory cannot be read. Node throws where the runtime answers a value,
 * so the `catch` is what makes the two agree, and a directory that exists and
 * is empty answers an empty array on both sides. Node's readdir never yields
 * `.` or `..` — the pair `runtime_os.c` skips explicitly — so there is nothing
 * to filter out here.
 *
 * The sort is the semantic point. `runtime_os.c` orders the names with
 * `strcmp`, which compares UTF-8 bytes, and `Array#sort` compares UTF-16 code
 * units. The two agree on ASCII names and part company above the BMP, where a
 * surrogate pair sorts below `U+E000`..`U+FFFF` in UTF-16 and above them in
 * UTF-8. So the comparison is over the encoded bytes, which is the native order
 * exactly rather than the native order for the names that happen to be ASCII.
 */
export function readdirSync(path) {
  let names;
  try {
    names = fs.readdirSync(path);
  } catch {
    return null;
  }
  return names.sort((a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")));
}

/**
 * `process.platform` / `process.arch` (WP14 §7a). Node's spellings are the
 * ones `runtime_os.c` answers with, so on any machine this compiler has a
 * triple for the two runtimes give the same string; elsewhere the native build
 * says `unknown` where Node names the platform, which is the one place they
 * part.
 */
export function platform() {
  return process.platform;
}

export function arch() {
  return process.arch;
}

/**
 * `getenv(name)` (WP19 R1): the value, or `null` when the variable is unset.
 * Node answers `undefined` there and the language has no `undefined`, so the
 * `??` is what makes the two runtimes agree; an empty value stays an empty
 * string on both sides, because `CC=` is set and `CC` unset is not.
 */
export function getenv(name) {
  return process.env[name] ?? null;
}

/**
 * `spawnSync(argv)` and `spawnSyncTo(argv, out, err)` (WP14 D4), which are one
 * run with its streams answered differently: the child's exit status, 128 + n
 * when signal n killed it, -1 for an empty vector or a program that would not
 * start. `runtime_os.c` puts one `static nish_spawn_impl` behind both builtins
 * for the same reason this module puts one function behind both helpers — the
 * argument vector, the wait and the signal convention are written once and
 * cannot drift between the two.
 *
 * `out` and `err` are paths for the child's stdout and stderr, and an **empty**
 * string leaves that stream inherited. Each file is created or truncated at
 * 0644, which is what `"w"` asks `open(2)` for (`O_WRONLY | O_CREAT | O_TRUNC`)
 * and what the runtime's file actions ask for. The descriptors opened here are
 * closed again whichever way the child went; natively the child opens them and
 * its exit drops them.
 */
function spawnImpl(argv, out, err) {
  if (argv.length === 0) return -1;
  const opened = [];
  const stream = (target) => {
    if (target.length === 0) return "inherit";
    const fd = fs.openSync(target, "w", 0o644);
    opened.push(fd);
    return fd;
  };
  try {
    const r = child_process.spawnSync(argv[0], argv.slice(1), {
      stdio: ["inherit", stream(out), stream(err)],
    });
    if (r.error !== undefined) return -1;
    if (r.signal !== null && r.signal !== undefined) return 128 + (os.constants.signals[r.signal] ?? 0);
    return r.status === null ? -1 : r.status;
  } catch {
    // A path that cannot be opened is, natively, a file action the child could
    // not perform, and `posix_spawnp` reports that through its return value:
    // -1, with no child having run. Opening the second path is what can fail
    // after the first file was already created, so the truncation a caller can
    // observe happens on both sides.
    return -1;
  } finally {
    for (const fd of opened) fs.closeSync(fd);
  }
}

/** `spawnSync(argv)`: the child inherits this process's streams, as it does natively. */
export function spawnSync(argv) {
  return spawnImpl(argv, "", "");
}

/** `spawnSyncTo(argv, stdoutPath, stderrPath)`: the same run with a stream sent to a file. */
export function spawnSyncTo(argv, out, err) {
  return spawnImpl(argv, out, err);
}

/**
 * `monotonicNanos()`: `process.hrtime.bigint()`, a monotonic clock in
 * nanoseconds (`CLOCK_MONOTONIC` on every platform that has it, which is the
 * one `runtime_os.c` reads). The value is a BigInt because that is how an `i64`
 * is held on this side.
 *
 * No rewrite can make a *reading* agree with a native run: both origins are
 * arbitrary and neither is the other's. Only the difference between two reads
 * means anything, so a differential program may compare two readings and must
 * never print one.
 */
export function monotonicNanos() {
  return process.hrtime.bigint();
}

/** `process.argv`: index 0 is the program (the script here, the executable natively), then the arguments. */
export function argv() {
  return process.argv.slice(1);
}

const SPACES = "[ \\t\\n\\v\\f\\r]*";
/** What `nish_parse_number` recognises: strtod's decimal and hex-integer forms, or an exact `Infinity`. */
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
//
// `nish --threads` makes the native arena thread-local (WP20 T0) and nothing
// here moves with it: a rewritten program runs on the one thread Node gives it,
// so "the arena of the calling thread" and "the arena" are the same object, and
// these stubs answer for both. If T1 ever lands a spawn the rewrite can reach,
// that is when this file grows a second arena to keep count of.
export function arenaUsed() { return 0; }
export function arenaMark() { return 0; }
export function arenaRelease() {}
export function arenaReset() {}
