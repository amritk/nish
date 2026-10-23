/**
 * The strings of the core: an Nish string is its UTF-8 bytes, so every length
 * and offset here counts bytes. Only the web's `TextEncoder` and `TextDecoder`
 * are used, and the decoder keeps a leading byte-order mark, as a cut through
 * the bytes must.
 */
import { panicIndex, panicSlice, toIndex } from "./checks.mjs";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { ignoreBOM: true });

/**
 * The UTF-8 byte length of `s` without encoding it: a lone surrogate counts the
 * three bytes of the U+FFFD it encodes as.
 */
function utf8Length(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}


/** The string `bytesOf` encoded last, and its bytes. */
let lastString = "";
let lastBytes = new Uint8Array(0);

/**
 * The UTF-8 bytes of `s`, which is what an Nish string holds. The last string
 * encoded is kept with its bytes, so a loop of `s.charCodeAt(i)` over one
 * string encodes it once rather than once per byte. Nothing here writes to
 * the bytes it is handed.
 */
function bytesOf(s) {
  if (s !== lastString) {
    lastBytes = ENCODER.encode(s);
    lastString = s;
  }
  return lastBytes;
}

/**
 * `s.length`: UTF-8 byte length for strings (arrays keep their own `.length`).
 * The engine's encoder outruns a count in JavaScript, and the loop condition
 * `i < s.length` then leaves the bytes for the `s.charCodeAt(i)` it guards.
 */
export function strLen(x) {
  return typeof x === "string" ? bytesOf(x).length : x.length;
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
  return DECODER.decode(bytes.subarray(Math.min(from, to), Math.max(from, to)));
}

/**
 * `s.slice(a, b)`: the bytes of `[a, b)` with no clamp, `b` defaulting to the
 * byte length (WP15 §4). Out of range panics rather than clamping, so the two
 * compares the native code emits are reproduced here rather than JavaScript's
 * negative-from-the-end rule.
 */
export function slice(s, a, b) {
  const bytes = bytesOf(s);
  const from = toIndex(a);
  const to = b === undefined ? bytes.length : toIndex(b);
  if (!(from >= 0 && from <= to && to <= bytes.length)) panicSlice(from, to, bytes.length);
  return DECODER.decode(bytes.subarray(from, to));
}

/** Whether `needle` sits in `bytes` at byte offset `at`. */
function bytesAt(bytes, at, needle) {
  if (!(at >= 0 && at + needle.length <= bytes.length)) return false;
  for (let j = 0; j < needle.length; j++) {
    if (bytes[at + j] !== needle[j]) return false;
  }
  return true;
}

/**
 * `s.indexOf(sub, from)`: the first *byte* offset at or after `from`, or -1.
 * `from` is converted as JavaScript's `ToIntegerOrInfinity` converts it (NaN
 * is 0) and clamped into `[0, len]`, so an empty `sub` is found at `from`.
 * The engine's `indexOf` over the bytes finds each candidate for `sub`'s
 * first byte, and only those are compared in full.
 */
export function indexOf(s, sub, from) {
  const haystack = bytesOf(s);
  const at = from === undefined ? 0 : toIndex(from);
  const start = Number.isNaN(at) ? 0 : Math.max(0, Math.min(at, haystack.length));
  if (sub.length === 0) return start;
  const needle = ENCODER.encode(sub);
  const last = haystack.length - needle.length;
  for (let i = haystack.indexOf(needle[0], start); i >= 0 && i <= last; i = haystack.indexOf(needle[0], i + 1)) {
    if (bytesAt(haystack, i, needle)) return i;
  }
  return -1;
}

/** `nish_str_at`: whether `sub`'s bytes sit at byte offset `at`. */
function occursAt(s, at, sub) {
  return bytesAt(bytesOf(s), at, ENCODER.encode(sub));
}

export function startsWith(s, sub) {
  return occursAt(s, 0, sub);
}

export function endsWith(s, sub) {
  return occursAt(s, utf8Length(s) - utf8Length(sub), sub);
}

/** `String.fromCharCode(c)`: the one-byte string of `c & 0xFF`. */
export function fromCharCode(code) {
  return String.fromCharCode(toIndex(code) & 0xff);
}

/**
 * `String.fromBytes(bytes, start, end)`: the bytes of `[start, end)`, one
 * code unit each as `fromCharCode` builds them, checked as `s.slice`'s range
 * is and failing with its panic. The copy into a `Uint8Array` reduces each
 * element to a byte as a `Buffer` store does, and the string is built a chunk
 * at a time so that no call passes more arguments than the engine takes.
 */
export function fromBytes(bytes, start, end) {
  const from = toIndex(start);
  const to = toIndex(end);
  if (!(from >= 0 && from <= to && to <= bytes.length)) panicSlice(from, to, bytes.length);
  const out = new Uint8Array(to - from);
  for (let i = from; i < to; i++) out[i - from] = bytes[i];
  let text = "";
  for (let i = 0; i < out.length; i += 8192) {
    text += String.fromCharCode.apply(null, out.subarray(i, i + 8192));
  }
  return text;
}

/**
 * `String.fromBytes(bytes, start, end)` as `--emit-ts` writes it: the bytes of
 * `[start, end)` decoded as UTF-8, which is the string a native program holds,
 * checked as `fromBytes`'s range is. A sequence that is not UTF-8 decodes to
 * U+FFFD where native keeps the bytes. `fromBytes` above stays the
 * one-unit-per-byte reading the prelude's programs are pinned to.
 */
export function utf8FromBytes(bytes, start, end) {
  const from = toIndex(start);
  const to = toIndex(end);
  if (!(from >= 0 && from <= to && to <= bytes.length)) panicSlice(from, to, bytes.length);
  const out = new Uint8Array(to - from);
  for (let i = from; i < to; i++) out[i - from] = bytes[i];
  return DECODER.decode(out);
}
