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
import { panicIndex, toIndex } from "./core/checks.mjs";

export * from "./core/arrays.mjs";
export * from "./core/host.mjs";
export * from "./core/numbers.mjs";
export * from "./core/result.mjs";
export * from "./core/strings.mjs";

// ---- `nish:simd` ------------------------------------------------------------
// A vector is a fresh typed array of its lanes, made once and never written
// after: `replace` copies, so a vector held in two places stays one value, as
// the native `<N x T>` register is. The array type does the lane arithmetic a
// native lane does: a `u8` lane wraps through `Uint8Array`, an `f32` lane rounds
// through `Float32Array`. `load…` and `store` check the whole vector once, and
// panic with the native words: the first index, and the array's length.

const simdMake = (Lanes) => (...lanes) => new Lanes(lanes);
const simdSplat = (Lanes) => (x) => new Lanes(16 / Lanes.BYTES_PER_ELEMENT).fill(x);
// The first index of `count` lanes at `i` in `xs`, or the native panic naming
// a lane that is out of range: the first when it is, else the last. A negative
// index prints as the unsigned 64-bit number the native compare saw.
const simdAt = (xs, i, count) => {
  const k = toIndex(i);
  if (k < 0) panicIndex(BigInt.asUintN(64, BigInt(k)), xs.length);
  if (k >= xs.length) panicIndex(k, xs.length);
  if (k + count > xs.length) panicIndex(k + count - 1, xs.length);
  return k;
};
const simdLoad = (Lanes) => (xs, i) => {
  const count = 16 / Lanes.BYTES_PER_ELEMENT;
  const k = simdAt(xs, i, count);
  const out = new Lanes(count);
  for (let j = 0; j < count; j++) out[j] = xs[k + j];
  return out;
};

export const u8x16 = simdMake(Uint8Array);
export const u16x8 = simdMake(Uint16Array);
export const i32x4 = simdMake(Int32Array);
export const u32x4 = simdMake(Uint32Array);
export const f32x4 = simdMake(Float32Array);
export const f64x2 = simdMake(Float64Array);
export const splatU8x16 = simdSplat(Uint8Array);
export const splatU16x8 = simdSplat(Uint16Array);
export const splatI32x4 = simdSplat(Int32Array);
export const splatU32x4 = simdSplat(Uint32Array);
export const splatF32x4 = simdSplat(Float32Array);
export const splatF64x2 = simdSplat(Float64Array);
export const loadU8x16 = simdLoad(Uint8Array);
export const loadU16x8 = simdLoad(Uint16Array);
export const loadI32x4 = simdLoad(Int32Array);
export const loadU32x4 = simdLoad(Uint32Array);
export const loadF32x4 = simdLoad(Float32Array);
export const loadF64x2 = simdLoad(Float64Array);

/** `store(v, xs, i)`: the lanes into `xs[i]` to `xs[i + N - 1]`, checked once. */
export function store(v, xs, i) {
  const k = simdAt(xs, i, v.length);
  for (let j = 0; j < v.length; j++) xs[k + j] = v[j];
}

/** `extract(v, k)`: lane `k`, a constant the checker held in range. */
export function extract(v, k) {
  return v[k];
}

/** `replace(v, k, x)`: a new vector, `v` with lane `k` set to `x`. */
export function replace(v, k, x) {
  const out = v.slice();
  out[k] = x;
  return out;
}

// ---- `nish:simd` lane operations ---------------------------------------------
// Each answers a fresh vector of its operands' type, and the typed array does
// the wrapping: a `u8` sum stored into a `Uint8Array` keeps its low byte, as
// `add <16 x i8>` does. A mask is an array of booleans, one a lane. `f32`
// arithmetic rounds once, through the array, which for `+ - * /` and `sqrt` is
// the single rounding the native lane does: the double result of two floats
// rounds to the same float. `Math.min` and `Math.max` are `llvm.minimum` and
// `llvm.maximum`: a NaN lane answers NaN and -0 orders below +0.

const simdLanes = (a, f) => {
  const out = new a.constructor(a.length);
  for (let j = 0; j < a.length; j++) out[j] = f(a[j], j);
  return out;
};
const simdMask = (a, f) => {
  const out = new Array(a.length);
  for (let j = 0; j < a.length; j++) out[j] = f(a[j], j);
  return out;
};
const simdBits = (a) => a.BYTES_PER_ELEMENT * 8;

export const add = (a, b) => simdLanes(a, (x, j) => x + b[j]);
export const sub = (a, b) => simdLanes(a, (x, j) => x - b[j]);
export const mul = (a, b) => simdLanes(a, (x, j) => x * b[j]);
export const div = (a, b) => simdLanes(a, (x, j) => x / b[j]);
export const neg = (a) => simdLanes(a, (x) => -x);
export const abs = (a) => simdLanes(a, (x) => Math.abs(x));
export const sqrt = (a) => simdLanes(a, (x) => Math.sqrt(x));
export const addWrapping = add;
export const subWrapping = sub;
// A 32-bit product loses its low bits as a double; `Math.imul` keeps them.
export const mulWrapping = (a, b) => simdLanes(a, (x, j) => (simdBits(a) === 32 ? Math.imul(x, b[j]) : x * b[j]));
export const min = (a, b) => simdLanes(a, (x, j) => Math.min(x, b[j]));
export const max = (a, b) => simdLanes(a, (x, j) => Math.max(x, b[j]));

/** `and`, `or`, `xor` and `not` take an integer vector or a mask. */
export const and = (a, b) => (Array.isArray(a) ? simdMask(a, (x, j) => x && b[j]) : simdLanes(a, (x, j) => x & b[j]));
export const or = (a, b) => (Array.isArray(a) ? simdMask(a, (x, j) => x || b[j]) : simdLanes(a, (x, j) => x | b[j]));
export const xor = (a, b) => (Array.isArray(a) ? simdMask(a, (x, j) => x !== b[j]) : simdLanes(a, (x, j) => x ^ b[j]));
export const not = (a) => (Array.isArray(a) ? simdMask(a, (x) => !x) : simdLanes(a, (x) => ~x));

// `ne` is the unordered compare: a NaN lane is unequal to everything.
export const eq = (a, b) => simdMask(a, (x, j) => x === b[j]);
export const ne = (a, b) => simdMask(a, (x, j) => x !== b[j]);
export const lt = (a, b) => simdMask(a, (x, j) => x < b[j]);
export const le = (a, b) => simdMask(a, (x, j) => x <= b[j]);
export const gt = (a, b) => simdMask(a, (x, j) => x > b[j]);
export const ge = (a, b) => simdMask(a, (x, j) => x >= b[j]);

export const select = (m, a, b) => simdLanes(a, (x, j) => (m[j] ? x : b[j]));
export const any = (m) => m.some((x) => x);
export const all = (m) => m.every((x) => x);
export const bitmask = (m) => m.reduce((bits, x, j) => (x ? bits | (1 << j) : bits), 0);

/**
 * `sum`: a float vector's lanes added first to last from -0, rounding each
 * step as `llvm.vector.reduce.fadd` does; a `u8` or `u16` vector's, which
 * cannot overflow an `i32`.
 */
export const sum = (a) => {
  let acc = -0;
  for (const x of a) acc = a instanceof Float32Array ? Math.fround(acc + x) : acc + x;
  return acc;
};
/** `sumWrapping`: a 32-bit vector's lanes added modulo 2^32. */
export const sumWrapping = (a) => {
  let acc = 0;
  for (const x of a) acc = (acc + x) | 0;
  return a instanceof Uint32Array ? acc >>> 0 : acc;
};

/** `shuffle(a, b, ...lanes)`: lane `k` of the 2N lanes `a` then `b`. */
export const shuffle = (a, b, ...lanes) => simdLanes(a, (_, j) => (lanes[j] < a.length ? a[lanes[j]] : b[lanes[j] - a.length]));

// A count is a constant below the lane width, so `x >>> (w - k)` is a real
// shift; at k = 0 and w = 32 JavaScript's count wraps to 0, and the `|` keeps x.
export const shl = (a, k) => simdLanes(a, (x) => x << k);
export const shr = (a, k) => simdLanes(a, (x) => (a instanceof Int32Array ? x >> k : x >>> k));
export const rotl = (a, k) => simdLanes(a, (x) => (x << k) | (x >>> (simdBits(a) - k)));
export const rotr = (a, k) => simdLanes(a, (x) => (x >>> k) | (x << (simdBits(a) - k)));

const simdAs = (Lanes) => (v) => new Lanes(v.buffer.slice(v.byteOffset, v.byteOffset + 16));
export const asU8x16 = simdAs(Uint8Array);
export const asU16x8 = simdAs(Uint16Array);
export const asI32x4 = simdAs(Int32Array);
export const asU32x4 = simdAs(Uint32Array);
export const asF32x4 = simdAs(Float32Array);
export const asF64x2 = simdAs(Float64Array);
