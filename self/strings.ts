// Wave C of the self-hosting plan (docs/wp14-selfhost.md §3): the library
// `self/` is written over. None of it needs a construct the language does not
// already have — it is listed in the plan only so that nobody mistakes it for
// language work.
//
// `StringBuilder` is the one with teeth. The emitter produces on the order of
// a megabyte of IR text, and `s = s + t` in a loop is quadratic in both time
// and memory: every concatenation allocates a fresh copy and the arena never
// reclaims, so building 88 KB of IR that way already costs 180 MB of peak RSS
// (§3). One `string[]` and one `join` at the end is one pass to sum the
// lengths, one allocation and one `memcpy` per part.

/**
 * An append-only buffer of string parts, flattened once by `toText`.
 *
 * Every part is a `string` the caller already has; nothing here converts a
 * number, because a template literal (`` `${n}` ``) does that in one call and
 * a conversion hidden inside the builder would allocate where the caller
 * cannot see it.
 */
export class StringBuilder {
  parts: string[];

  constructor() {
    this.parts = [];
  }

  add(text: string): void {
    this.parts.push(text);
  }

  /** One byte, for the escapes and separators written a character at a time. */
  addChar(code: i32): void {
    this.parts.push(String.fromCharCode(code));
  }

  /** The bytes added so far, without building the result. */
  length(): i32 {
    let total = 0;
    for (const part of this.parts) {
      total = total + part.length;
    }
    return total;
  }

  isEmpty(): boolean {
    return this.parts.length === 0;
  }

  /** Everything added, in order. The builder stays usable afterwards. */
  toText(): string {
    return this.parts.join("");
  }

  /** Drop the contents and keep the capacity, so the next use reuses it. */
  reset(): void {
    while (this.parts.length > 0) {
      this.parts.pop();
    }
  }
}

/**
 * Byte-wise lexicographic order: negative, zero or positive as `a` sorts
 * before, with, or after `b`. The language has no `<` on strings deliberately
 * (docs/LANGUAGE.md, Operators), so every ordering in `self/` — sorted
 * diagnostics, a deterministic symbol dump — goes through this.
 *
 * The bytes are UTF-8 and `charCodeAt` zero-extends, so this is code-point
 * order for anything valid, which is what a stable output wants.
 */
export const compareStrings = (a: string, b: string): i32 => {
  let shared = a.length;
  if (b.length < shared) {
    shared = b.length;
  }
  let i = 0;
  while (i < shared) {
    const ca = a.charCodeAt(i);
    const cb = b.charCodeAt(i);
    if (ca !== cb) {
      return ca < cb ? -1 : 1;
    }
    i = i + 1;
  }
  if (a.length === b.length) {
    return 0;
  }
  return a.length < b.length ? -1 : 1;
};

const HEX_LOWER: string = "0123456789abcdef";
const HEX_UPPER: string = "0123456789ABCDEF";

/** The low nibble of `value` as one lowercase hex digit. */
export const hexDigitLower = (value: i32): string => HEX_LOWER.substring(value & 15, (value & 15) + 1);

/** The low nibble of `value` as one uppercase hex digit. */
export const hexDigitUpper = (value: i32): string => HEX_UPPER.substring(value & 15, (value & 15) + 1);

/** `value` as exactly `digits` uppercase hex digits, most significant first. */
export const hexOfI64 = (value: i64, digits: i32): string => {
  const out = new StringBuilder();
  let shift = (digits - 1) * 4;
  while (shift >= 0) {
    out.add(hexDigitUpper(toI32(value >> toI64(shift)) & 15));
    shift = shift - 4;
  }
  return out.toText();
};

/**
 * An `f64` as LLVM writes it: `0x` and the 16 uppercase hex digits of the
 * IEEE-754 bit pattern. LLVM only accepts decimal float literals that
 * round-trip exactly, so the hex form is the only one always valid, and
 * `f64ToBits` (WP14 B1) is what makes it reachable from the language at all.
 */
export const f64Hex = (value: f64): string => `0x${hexOfI64(f64ToBits(value), 16)}`;

/**
 * The same for an `f32`. LLVM writes a `float` constant with the *64-bit* hex
 * of the double it equals and requires that double to be exactly
 * representable as a float, which the round trip through `toF32` guarantees.
 */
export const f32Hex = (value: f64): string => f64Hex(toF64(toF32(value)));

/**
 * `s` as a JSON string literal, matching `JSON.stringify` byte for byte: the
 * seven short escapes, `\u00xx` in lowercase below `0x20`, and every other
 * byte verbatim — including `0x7f` and the UTF-8 continuation bytes, which
 * `JSON.stringify` also passes through.
 */
export const jsonQuote = (s: string): string => {
  const out = new StringBuilder();
  out.addChar(34);
  let i = 0;
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c === 34) {
      out.add('\\"');
    } else if (c === 92) {
      out.add("\\\\");
    } else if (c === 8) {
      out.add("\\b");
    } else if (c === 9) {
      out.add("\\t");
    } else if (c === 10) {
      out.add("\\n");
    } else if (c === 12) {
      out.add("\\f");
    } else if (c === 13) {
      out.add("\\r");
    } else if (c < 32) {
      out.add("\\u00");
      out.add(hexDigitLower(c >> 4));
      out.add(hexDigitLower(c));
    } else {
      out.addChar(c);
    }
    i = i + 1;
  }
  out.addChar(34);
  return out.toText();
};

/**
 * The body of an LLVM `c"..."` constant: printable ASCII verbatim except `"`
 * and `\`, everything else `\XX` in uppercase. This is a different escape
 * from `jsonQuote` — LLVM has no `\n` — and mixing the two writes IR that
 * assembles into the wrong bytes, so they sit side by side here.
 */
export const irEscape = (s: string): string => {
  const out = new StringBuilder();
  let i = 0;
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c >= 32 && c <= 126 && c !== 34 && c !== 92) {
      out.addChar(c);
    } else {
      out.addChar(92);
      out.add(hexDigitUpper(c >> 4));
      out.add(hexDigitUpper(c));
    }
    i = i + 1;
  }
  return out.toText();
};

/**
 * `text` cut at every occurrence of one byte, exactly as JavaScript's
 * `split(sep)` cuts: the pieces between the separators, empties included, so
 * `"/a".split("/")` is `["", "a"]` and `""` is `[""]`. Callers that want the
 * empties gone drop them; a splitter that dropped them for everybody could
 * not tell `a//b` from `a/b`, which is the distinction `paths.ts` is built on.
 */
export const splitByte = (text: string, separator: i32): string[] => {
  const parts: string[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    if (text.charCodeAt(i) === separator) {
      parts.push(text.substring(start, i));
      start = i + 1;
    }
    i = i + 1;
  }
  parts.push(text.substring(start, text.length));
  return parts;
};

/** `s` repeated `count` times; `count <= 0` is the empty string. */
export const repeatString = (s: string, count: i32): string => {
  const out = new StringBuilder();
  let i = 0;
  while (i < count) {
    out.add(s);
    i = i + 1;
  }
  return out.toText();
};
