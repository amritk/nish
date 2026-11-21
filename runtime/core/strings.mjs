/**
 * The strings of the core: an Nish string is its UTF-8 bytes, so every length
 * and offset here counts bytes. Only the web's `TextEncoder` and `TextDecoder`
 * are used, and the decoder keeps a leading byte-order mark, as a cut through
 * the bytes must. Decoding is lossy where native is not: bytes that are not
 * UTF-8, or a cut through a character, decode to U+FFFD, whose three bytes
 * then change the string's length.
 */
import { panicIndex, panicSlice, toIndex } from "./checks.mjs";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { ignoreBOM: true });

/** A UTF-16 unit that is not ASCII, so its UTF-8 bytes are not its units. */
const NON_ASCII = /[^\x00-\x7f]/;

/**
 * How many strings `bytesOf` keeps. A loop alternates between strings: std's
 * `indexOfAnyFrom` and `yamlByte` read a byte of the document, then of a
 * needle or a word, per step, so a cache of one encodes the document on every
 * read. Eight covers the most std's loops keep live at once.
 */
const SLOTS = 8;

/**
 * The strings `bytesOf` saw last, most recent first, and their bytes: `null`
 * for an ASCII string, whose units are its bytes and which is never encoded.
 * A hit moves its entry to the front and a miss drops the last one, so a
 * string stays while it is read and leaves when it is not. A lookup compares
 * at most `SLOTS` strings with `===`, which answers at once for the same
 * string or a different length and otherwise stops at the first unit that
 * differs.
 */
const keys = new Array(SLOTS).fill("");
const values = new Array(SLOTS).fill(null);
let used = 0;

/**
 * The UTF-8 bytes of `s`, which is what an Nish string holds, or `null` when
 * `s` is ASCII and its UTF-16 units are those bytes. Nothing here writes to
 * the bytes it is handed.
 */
function bytesOf(s) {
  if (keys[0] === s) return values[0];
  let at = 1;
  while (at < used && keys[at] !== s) at++;
  let bytes;
  if (at < used) {
    bytes = values[at];
  } else {
    bytes = NON_ASCII.test(s) ? ENCODER.encode(s) : null;
    if (used < SLOTS) used++;
    at = used - 1;
  }
  for (; at > 0; at--) {
    keys[at] = keys[at - 1];
    values[at] = values[at - 1];
  }
  keys[0] = s;
  values[0] = bytes;
  return bytes;
}

/**
 * `s.length`: UTF-8 byte length for strings (arrays keep their own `.length`).
 * The loop condition `i < s.length` then leaves the bytes for the
 * `s.charCodeAt(i)` it guards.
 */
export function strLen(x) {
  if (typeof x !== "string") return x.length;
  const bytes = bytesOf(x);
  return bytes === null ? x.length : bytes.length;
}

/**
 * `s?.length` in a `?.` chain: `undefined` when the chain has stopped at a
 * `null` or `undefined` link, as `?.` answers, and the byte length otherwise.
 * The chain is its argument, so it is evaluated once and its short circuit
 * kept.
 */
export function strLenOpt(x) {
  return x === null || x === undefined ? undefined : strLen(x);
}

/** `s.charCodeAt(i)`: the byte at `i`, bounds-checked as `a[i]` is (JavaScript answers NaN). */
export function charCodeAt(s, i) {
  const bytes = bytesOf(s);
  const k = toIndex(i);
  if (bytes === null) {
    if (!(k >= 0 && k < s.length)) panicIndex(k, s.length);
    return s.charCodeAt(k);
  }
  if (!(k >= 0 && k < bytes.length)) panicIndex(k, bytes.length);
  return bytes[k];
}

/** `s.substring(a, b)`: JavaScript's clamp and swap, over byte offsets. */
export function substring(s, a, b) {
  const bytes = bytesOf(s);
  const len = bytes === null ? s.length : bytes.length;
  const clamp = (v) => Math.max(0, Math.min(toIndex(v), len));
  const from = clamp(a);
  const to = b === undefined ? len : clamp(b);
  if (bytes === null) return s.substring(from, to);
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
  const len = bytes === null ? s.length : bytes.length;
  const from = toIndex(a);
  const to = b === undefined ? len : toIndex(b);
  if (!(from >= 0 && from <= to && to <= len)) panicSlice(from, to, len);
  return bytes === null ? s.slice(from, to) : DECODER.decode(bytes.subarray(from, to));
}

/**
 * Whether `sub` sits in `bytes` at byte offset `at`; `needle` is `sub`'s
 * bytes, or `null` when `sub` is ASCII and its units are compared instead.
 */
function bytesAt(bytes, at, sub, needle) {
  const n = needle === null ? sub.length : needle.length;
  if (!(at >= 0 && at + n <= bytes.length)) return false;
  for (let j = 0; j < n; j++) {
    if (bytes[at + j] !== (needle === null ? sub.charCodeAt(j) : needle[j])) return false;
  }
  return true;
}

/**
 * `s.indexOf(sub, from)`: the first *byte* offset at or after `from`, or -1.
 * `from` is converted as JavaScript's `ToIntegerOrInfinity` converts it (NaN
 * is 0) and clamped into `[0, len]`, so an empty `sub` is found at `from`.
 * In an ASCII `s` the engine's own `indexOf` answers: offsets are bytes there,
 * and a `sub` that is not ASCII is in it nowhere, as none of its bytes are.
 * Otherwise the engine's `indexOf` over the bytes finds each candidate for
 * `sub`'s first byte, and only those are compared in full.
 */
export function indexOf(s, sub, from) {
  const haystack = bytesOf(s);
  const len = haystack === null ? s.length : haystack.length;
  const at = from === undefined ? 0 : toIndex(from);
  const start = Number.isNaN(at) ? 0 : Math.max(0, Math.min(at, len));
  if (sub.length === 0) return start;
  if (haystack === null) return s.indexOf(sub, start);
  const needle = bytesOf(sub);
  const first = needle === null ? sub.charCodeAt(0) : needle[0];
  const last = len - (needle === null ? sub.length : needle.length);
  for (let i = haystack.indexOf(first, start); i >= 0 && i <= last; i = haystack.indexOf(first, i + 1)) {
    if (bytesAt(haystack, i, sub, needle)) return i;
  }
  return -1;
}

/** `s.startsWith(sub)`: whether `sub`'s bytes begin `s`'s; an ASCII `s` asks the engine. */
export function startsWith(s, sub) {
  const bytes = bytesOf(s);
  if (bytes === null) return s.startsWith(sub);
  return bytesAt(bytes, 0, sub, bytesOf(sub));
}

/** `s.endsWith(sub)`: whether `sub`'s bytes end `s`'s; an ASCII `s` asks the engine. */
export function endsWith(s, sub) {
  const bytes = bytesOf(s);
  if (bytes === null) return s.endsWith(sub);
  const needle = bytesOf(sub);
  return bytesAt(bytes, bytes.length - (needle === null ? sub.length : needle.length), sub, needle);
}

/**
 * `String.fromCharCode(c)`: the one-unit string of `c & 0xFF`. Under 128 that
 * is the one byte native builds; from 128 it is the Latin-1 character, two
 * UTF-8 bytes where native holds one (LANGUAGE.md's C row).
 */
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
