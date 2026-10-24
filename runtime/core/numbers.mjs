/**
 * The numeric half of the core (docs/RUN_UNDER_NODE.md): the integer widths,
 * their wrapping arithmetic and conversions, and the text-to-number readers.
 */
import { panic } from "./host.mjs";

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

/** `f32ToBits`: the 32 bits of an `f32`, signed like the compiler's i32. */
export function f32ToBits(x) {
  BITS.setFloat32(0, x);
  return BITS.getInt32(0);
}

export function bitsToF64(b) {
  BITS.setBigInt64(0, BigInt.asIntN(64, b));
  return BITS.getFloat64(0);
}

/**
 * `ctSelect` / `ctEq` (WP34 N6). A `u32` is a `number` here and a `u64` a
 * BigInt, so the operands' kind picks the width, and a mix of the two — which
 * the native checker refuses, and which a `u64` written as a bare literal is
 * under an unrewritten run — throws the `TypeError` BigInt arithmetic throws
 * rather than comparing a number with a BigInt and answering zero. JavaScript's
 * `&` reads a `number` as a signed 32-bit integer, so each answer is put back in
 * range with `>>> 0` or `asUintN(64, ...)`. These branch: only the native
 * lowering promises constant time.
 */
function ctWide(name, first, second, third) {
  const wide = typeof first === "bigint";
  if ((typeof second === "bigint") !== wide || (typeof third === "bigint") !== wide) {
    throw new TypeError(`${name}: cannot mix a u64 (BigInt) with a u32 (number)`);
  }
  return wide;
}

const U64_ONES = (1n << 64n) - 1n;

export function ctSelect(mask, a, b) {
  if (ctWide("ctSelect", mask, a, b)) return wrapU64((a & mask) | (b & ~mask));
  return ((a & mask) | (b & ~mask)) >>> 0;
}

export function ctEq(a, b) {
  // `ctEq` has two operands, so the second one stands in for the third.
  if (ctWide("ctEq", a, b, b)) return wrapU64(a ^ b) === 0n ? U64_ONES : 0n;
  return (a ^ b) === 0 ? 0xffffffff : 0;
}

// ---- Checked arithmetic (wp33 R4) ----------------------------------------------------
//
// What `--emit-ts` writes for a signed `+ - *` and unary minus the compiler
// neither proved in range nor was told to wrap (`--wrapping`): the exact
// answer, or the panic `nish_panic_overflow` prints, in its words. An i32 is
// exact in a double until it leaves the range, and `Math.imul` is the
// wrapped product, so a product that differs from the double one overflowed.
// A `bigint` operand is an i64.

export function checkedAdd(a, b) {
  return typeof a === "bigint" ? checkI64(a + b, "add") : checkI32(a + b, "add");
}
export function checkedSub(a, b) {
  return typeof a === "bigint" ? checkI64(a - b, "subtract") : checkI32(a - b, "subtract");
}
export function checkedMul(a, b) {
  if (typeof a === "bigint") return checkI64(a * b, "multiply");
  const r = Math.imul(a, b);
  if (r !== a * b) panic("attempt to multiply with overflow");
  return r;
}
export function checkedNeg(a) {
  return typeof a === "bigint" ? checkI64(-a, "negate") : checkI32(0 - a, "negate");
}
function checkI32(r, op) {
  if (r > I32_MAX || r < I32_MIN) panic(`attempt to ${op} with overflow`);
  return r;
}
function checkI64(r, op) {
  if (r > I64_MAX || r < I64_MIN) panic(`attempt to ${op} with overflow`);
  return r;
}

// `wrappingAdd`, `wrappingSub` and `wrappingMul` from `nish:unsafe`: the
// two's-complement answer at the operands' width, i32 or i64, whatever
// `--wrapping` says.
export function wrappingAdd(a, b) {
  return typeof a === "bigint" ? BigInt.asIntN(64, a + b) : (a + b) | 0;
}
export function wrappingSub(a, b) {
  return typeof a === "bigint" ? BigInt.asIntN(64, a - b) : (a - b) | 0;
}
export function wrappingMul(a, b) {
  return typeof a === "bigint" ? BigInt.asIntN(64, a * b) : Math.imul(a, b);
}

/**
 * Integer `/` and `%` at every width: `sdiv`/`udiv` and `srem`/`urem`, which
 * truncate, and the two panics the compiler guards them with. Only a signed
 * operand can be the minimum, so the overflow test needs no width. A double
 * quotient of two 32-bit integers truncates exactly, and `+ 0` turns the `-0`
 * of `-1 / 2` or `-4 % 2` into the integer zero.
 */
export function idiv(a, b) {
  divCheck(a, b);
  return typeof a === "bigint" ? a / b : Math.trunc(a / b) + 0;
}
export function irem(a, b) {
  divCheck(a, b);
  return typeof a === "bigint" ? a % b : (a % b) + 0;
}
function divCheck(a, b) {
  if (b === 0 || b === 0n) panic("attempt to divide by zero");
  if ((a === I32_MIN && b === -1) || (a === I64_MIN && b === -1n)) panic("attempt to divide with overflow");
}

/**
 * `Math.min`/`Math.max` on a float: `llvm.minnum`/`maxnum`, where a NaN
 * operand gives the other one; Math's answer NaN is only for two NaNs.
 */
export function minF64(a, b) {
  return Number.isNaN(a) ? b : Number.isNaN(b) ? a : Math.min(a, b);
}
export function maxF64(a, b) {
  return Number.isNaN(a) ? b : Number.isNaN(b) ? a : Math.max(a, b);
}

/**
 * `Math.round` as the compiler lowers it: `floor(x)`, plus one when the
 * fraction is at least a half. `-0.3` floors to `-1` and rounds to `+0`,
 * where Math's answer is `-0`; NaN, the infinities and `-0` come back as they
 * went in.
 */
export function roundF64(x) {
  const f = Math.floor(x);
  return x - f >= 0.5 ? f + 1 : f;
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

/** A method's arguments with each `bigint` from the `first` on made a number: the offsets and indices `--emit-ts` cannot wrap one by one. */
export function offsets(first, args) {
  for (let i = first; i < args.length; i++) {
    if (typeof args[i] === "bigint") args[i] = Number(args[i]);
  }
  return args;
}
