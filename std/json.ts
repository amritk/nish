/**
 * `std/json` — the value of one field of one flat JSON object.
 *
 * It exists because the compiler's own machine-readable surface is JSON: under
 * `--json` every diagnostic is one flat object on a line of stdout, whose `code`
 * is a stable rule identifier (`AGENTS.md`, and `docs/wp12-release.md` for the
 * exit-code bands). A Nish program that reads that surface — a wrapper, an
 * editor plug-in, or `tests/nish/cli.ts`, which pins the contract — needs the
 * value of a named field and nothing else, and the language has no `JSON.parse`
 * to give it.
 *
 * So this is a **reader, not a parser**, and the difference is worth stating:
 *
 *   - It answers **text**. A string field comes back with its escapes decoded
 *     and without its quotes; a number, a `true` or a `null` comes back as the
 *     bytes it was written with, for `parseInt` or `===` at the call site. A
 *     field whose value is `null` and one whose value is the *string* `"null"`
 *     therefore answer the same thing, which is the one ambiguity a program that
 *     needs to tell them apart cannot live with — and the sign that it wants a
 *     real parser rather than this.
 *   - It answers `null` for a field that is not there, so "absent" and "empty"
 *     stay apart the way they do in `getenv`.
 *   - It **does not validate**. A nested object or array is stepped over so that
 *     the fields after it are still reachable, and a truncated object still
 *     answers the fields that precede the truncation. A program that has to know
 *     whether the whole line was well-formed is asking a question this does not
 *     answer.
 *
 * There is one exported function on purpose. A `std/` module is compiled into
 * the program that imports it and the symbol namespace is flat
 * (`std/README.md`), so every name here is a name its importer cannot use: the
 * helpers are `json`-prefixed and the reader is the only export. Splitting a
 * stream into lines and picking the ones that start with `{` is two calls the
 * caller already has — `splitLines` from `std/text` and `startsWith` — and
 * duplicating them here would cost more names than it saves.
 *
 *     import { jsonField } from "nish/json";
 *
 *     for (const line of splitLines(stdout)) {
 *       if (!line.startsWith("{")) {
 *         continue;
 *       }
 *       const code = jsonField(line, "code");
 *       if (code !== null && code === "NL0003") {
 *         panic("the compiler crashed");
 *       }
 *     }
 *
 * Every offset here is a **byte** offset and every width is spelled, with each
 * length and byte a builtin answers read through `toI32` — `.length` and
 * `charCodeAt` answer `number`, which is `f64` under `--number-mode f64`, so the
 * conversion is what makes this one module in both modes rather than two
 * (`docs/wp26-stdlib.md` §4).
 */

const JSON_TAB: i32 = 9;
const JSON_NEWLINE: i32 = 10;
const JSON_CARRIAGE_RETURN: i32 = 13;
const JSON_SPACE: i32 = 32;
const JSON_QUOTE: i32 = 34;
const JSON_COMMA: i32 = 44;
const JSON_COLON: i32 = 58;
const JSON_BACKSLASH: i32 = 92;
const JSON_OPEN_BRACKET: i32 = 91;
const JSON_CLOSE_BRACKET: i32 = 93;
const JSON_OPEN_BRACE: i32 = 123;
const JSON_CLOSE_BRACE: i32 = 125;
/**
 * The UTF-8 tags a `\u` escape is rebuilt out of: a two-byte lead is
 * `110xxxxx`, a three-byte lead `1110xxxx`, a continuation byte `10xxxxxx`, and
 * `LOW_SIX` is the six bits each continuation carries.
 *
 * They are named constants rather than the literals `192`, `224`, `128` and `63`
 * for a reason that is the module's rule and not a style preference: a bare
 * numeric literal is a `number`, which is an `f64` under `--number-mode f64`, so
 * `192 + (code >> 6)` adds an `f64` to an `i32` there and does not compile at all
 * (`docs/wp26-stdlib.md` §4, and `tests/link/std_text_f64` is what says so). A
 * constant declared `i32` means the same thing in both modes.
 */
const JSON_UTF8_TWO_BYTE_LEAD: i32 = 192;
const JSON_UTF8_THREE_BYTE_LEAD: i32 = 224;
const JSON_UTF8_CONTINUATION: i32 = 128;
const JSON_UTF8_LOW_SIX: i32 = 63;
/** The first code point that needs two UTF-8 bytes, and the first that needs three. */
const JSON_UTF8_TWO_BYTE_FLOOR: i32 = 128;
const JSON_UTF8_THREE_BYTE_FLOOR: i32 = 2048;
/** The base `jsonHex4` accumulates in. */
const JSON_HEX_BASE: i32 = 16;

/** The four bytes JSON allows between tokens. */
const jsonIsBlankByte = (code: i32): boolean =>
  code === JSON_SPACE || code === JSON_TAB || code === JSON_NEWLINE || code === JSON_CARRIAGE_RETURN;

/**
 * The first index at or after `from` that is not blank, or the length.
 *
 * Every caller hands in an index it has already found, so `from` is never
 * negative; the guard says so in a form the bounds proof reads, and is what
 * lets the loop below read `text` without a check.
 */
const jsonSkipBlank = (text: string, from: i32): i32 => {
  if (from < 0) {
    return from;
  }
  const length: i32 = toI32(text.length);
  let i: i32 = from;
  while (i < length && jsonIsBlankByte(toI32(text.charCodeAt(i)))) {
    i += 1;
  }
  return i;
};

/**
 * The index just past the string literal whose opening quote is at `at`, or `-1`
 * when the quote is never closed. A backslash takes the byte after it with it,
 * which is all a scanner needs to know about escapes: `\"` cannot end the
 * literal and `\\` cannot make the next quote an escape.
 */
const jsonEndOfString = (text: string, at: i32): i32 => {
  const length: i32 = toI32(text.length);
  if (at < 0) {
    return -1;
  }
  let i: i32 = at + 1;
  while (i < length) {
    const code: i32 = toI32(text.charCodeAt(i));
    if (code === JSON_BACKSLASH) {
      i += 2;
      continue;
    }
    if (code === JSON_QUOTE) {
      return i + 1;
    }
    i += 1;
  }
  return -1;
};

/**
 * The index just past the value that starts at `at`, or `-1` when it does not
 * end.
 *
 * A string ends at its quote and an object or array at the closer that brings
 * the depth back to zero, with strings inside it skipped whole so that a `}` in
 * a message cannot close it. Anything else — a number, `true`, `false`, `null` —
 * ends at the first byte that cannot be part of it, which is the comma, the
 * closer or the blank that follows.
 *
 * The string skip inside an object is a flag in the one loop rather than a call
 * to `jsonEndOfString` that moves the cursor to wherever it answers: a cursor
 * that only ever steps forward keeps the lower bound the bounds proof needs,
 * and one assigned a callee's answer does not.
 */
const jsonEndOfValue = (text: string, at: i32): i32 => {
  const length: i32 = toI32(text.length);
  if (at < 0 || at >= length) {
    return -1;
  }
  const first: i32 = toI32(text.charCodeAt(at));
  if (first === JSON_QUOTE) {
    return jsonEndOfString(text, at);
  }
  if (first === JSON_OPEN_BRACE || first === JSON_OPEN_BRACKET) {
    let depth: i32 = 0;
    let inString: boolean = false;
    let i: i32 = at;
    while (i < length) {
      const code: i32 = toI32(text.charCodeAt(i));
      if (inString) {
        // `jsonEndOfString`'s rule: a backslash takes the byte after it along.
        if (code === JSON_BACKSLASH) {
          i += 2;
          continue;
        }
        if (code === JSON_QUOTE) {
          inString = false;
        }
        i += 1;
        continue;
      }
      if (code === JSON_QUOTE) {
        inString = true;
      } else if (code === JSON_OPEN_BRACE || code === JSON_OPEN_BRACKET) {
        depth += 1;
      } else if (code === JSON_CLOSE_BRACE || code === JSON_CLOSE_BRACKET) {
        depth -= 1;
        if (depth === 0) {
          return i + 1;
        }
      }
      i += 1;
    }
    return -1;
  }
  let i: i32 = at;
  while (i < length) {
    const code: i32 = toI32(text.charCodeAt(i));
    if (code === JSON_COMMA || code === JSON_CLOSE_BRACE || code === JSON_CLOSE_BRACKET) {
      return i;
    }
    if (jsonIsBlankByte(code)) {
      return i;
    }
    i += 1;
  }
  return length;
};

/** The value of one lower-case or upper-case hex digit, or `-1`. */
const jsonHexDigit = (code: i32): i32 => {
  if (code >= 48 && code <= 57) {
    return code - 48;
  }
  if (code >= 97 && code <= 102) {
    return code - 87;
  }
  if (code >= 65 && code <= 70) {
    return code - 55;
  }
  return -1;
};

/** The four hex digits at `at` as one code point, or `-1` when they are not four hex digits. */
const jsonHex4 = (text: string, at: i32, end: i32): i32 => {
  if (at + 4 > end) {
    return -1;
  }
  let value: i32 = 0;
  let i: i32 = 0;
  while (i < 4) {
    const digit: i32 = jsonHexDigit(toI32(text.charCodeAt(at + i)));
    if (digit < 0) {
      return -1;
    }
    value = value * JSON_HEX_BASE + digit;
    i += 1;
  }
  return value;
};

/**
 * `code` as UTF-8, one to three bytes.
 *
 * A surrogate pair is **not** recombined: each half becomes its own three-byte
 * sequence, which is what `😀` reads as here. Nothing this module
 * exists to read produces one — `JSON.stringify`, and `jsonQuote` in
 * `self/strings.ts` which matches it byte for byte, escape only the seven short
 * forms and `\u00xx` below `0x20`, and pass every other byte through as itself —
 * so the alternative would be code with no caller to keep it honest.
 */
const jsonUtf8 = (code: i32): string => {
  if (code < JSON_UTF8_TWO_BYTE_FLOOR) {
    return String.fromCharCode(code);
  }
  if (code < JSON_UTF8_THREE_BYTE_FLOOR) {
    const lead: string = String.fromCharCode(JSON_UTF8_TWO_BYTE_LEAD + (code >> 6));
    return `${lead}${String.fromCharCode(JSON_UTF8_CONTINUATION + (code & JSON_UTF8_LOW_SIX))}`;
  }
  const lead: string = String.fromCharCode(JSON_UTF8_THREE_BYTE_LEAD + (code >> 12));
  const middle: string = String.fromCharCode(JSON_UTF8_CONTINUATION + ((code >> 6) & JSON_UTF8_LOW_SIX));
  return `${lead}${middle}${String.fromCharCode(JSON_UTF8_CONTINUATION + (code & JSON_UTF8_LOW_SIX))}`;
};

/**
 * The bytes of `text[at..end)` with the JSON escapes decoded — the body of a
 * string literal, without its quotes.
 *
 * A literal with no backslash in it is answered as a substring, which is the
 * common case and the whole reason for the first loop: a diagnostic's `file` and
 * `code` never carry an escape, and building them out of parts would allocate an
 * array to copy a string that was already there. An unknown escape stands for
 * the byte it escapes, which is what `\"`, `\\` and `\/` want and is the lenient
 * reading of anything else.
 */
const jsonUnescape = (text: string, at: i32, end: i32): string => {
  // Both callers pass the inside of a literal `jsonEndOfString` found, so
  // `0 <= at` and `end <= text.length` always hold. Saying so here is what
  // proves every read below in range and drops the `substring` clamps.
  if (at < 0 || end > toI32(text.length)) {
    return "";
  }
  let i: i32 = at;
  while (i < end && toI32(text.charCodeAt(i)) !== JSON_BACKSLASH) {
    i += 1;
  }
  if (i >= end) {
    return text.substring(at, end);
  }
  const parts: string[] = [];
  let start: i32 = at;
  while (i < end) {
    if (toI32(text.charCodeAt(i)) !== JSON_BACKSLASH) {
      i += 1;
      continue;
    }
    // `start === i` is an escape straight after another, and the empty run
    // between them adds nothing to the join. The `start >= 0` half is always
    // true — `start` is `at` or a cursor that has only moved forward — and is
    // there because `start` is reassigned in the loop, which is where the
    // bounds proof stops following it.
    if (start >= 0 && start < i) {
      parts.push(text.substring(start, i));
    }
    // A trailing backslash has nothing after it: `0` is no escape letter, so it
    // falls to the default below and stands for itself.
    const letter: i32 = i + 1 < end ? toI32(text.charCodeAt(i + 1)) : 0;
    if (letter === 110) {
      parts.push("\n");
      i += 2;
    } else if (letter === 116) {
      parts.push("\t");
      i += 2;
    } else if (letter === 114) {
      parts.push("\r");
      i += 2;
    } else if (letter === 98) {
      parts.push(String.fromCharCode(8));
      i += 2;
    } else if (letter === 102) {
      parts.push(String.fromCharCode(12));
      i += 2;
    } else if (letter === 117) {
      const code: i32 = jsonHex4(text, i + 2, end);
      if (code < 0) {
        // Not four hex digits after the `u`: the escape is broken, and copying it
        // through unchanged is the reading that loses nothing.
        parts.push("\\u");
        i += 2;
      } else {
        parts.push(jsonUtf8(code));
        i += 6;
      }
    } else if (letter === 0) {
      parts.push("\\");
      i += 1;
    } else {
      parts.push(String.fromCharCode(letter));
      i += 2;
    }
    start = i;
  }
  parts.push(text.substring(start, end));
  return parts.join("");
};

/**
 * The value of `name` in `object`, or `null` when the object does not have that
 * field.
 *
 * A string value comes back unquoted and unescaped; any other value comes back
 * as the bytes it was written with, so `parseInt` reads a number and `=== "true"`
 * reads a boolean. The scan is left to right and answers the **first** field of
 * that name, which is what a duplicated key means to every JSON reader that does
 * not build a map.
 *
 * A nested value is stepped over rather than searched, so `name` is a field of
 * this object and not a path into it: that is the "flat" in the module header,
 * and it is the shape the compiler's `--json` line has.
 */
export const jsonField = (object: string, name: string): string | null => {
  const length: i32 = toI32(object.length);
  let i: i32 = jsonSkipBlank(object, 0);
  if (i >= length || toI32(object.charCodeAt(i)) !== JSON_OPEN_BRACE) {
    return null;
  }
  i = jsonSkipBlank(object, i + 1);
  // `jsonSkipBlank` never answers a negative index for a non-negative one, but
  // the bounds proof does not look inside a callee, so every cursor it answers
  // is tested for `i < 0` beside `i >= length`: the pair is what lets each read
  // below go without a check.
  while (i >= 0 && i < length && toI32(object.charCodeAt(i)) === JSON_QUOTE) {
    const keyEnd: i32 = jsonEndOfString(object, i);
    if (keyEnd < 0) {
      return null;
    }
    const key: string = jsonUnescape(object, i + 1, keyEnd - 1);
    i = jsonSkipBlank(object, keyEnd);
    if (i < 0 || i >= length || toI32(object.charCodeAt(i)) !== JSON_COLON) {
      return null;
    }
    const valueAt: i32 = jsonSkipBlank(object, i + 1);
    const valueEnd: i32 = jsonEndOfValue(object, valueAt);
    // `jsonEndOfValue` answers `-1` for a `valueAt` outside the object and never
    // answers past its end, so the last three tests change no answer: they are
    // the range the value's first byte and its `substring` are proved in.
    if (valueEnd < 0 || valueAt < 0 || valueAt >= length || valueEnd > toI32(object.length)) {
      return null;
    }
    if (key === name) {
      if (toI32(object.charCodeAt(valueAt)) === JSON_QUOTE) {
        return jsonUnescape(object, valueAt + 1, valueEnd - 1);
      }
      return object.substring(valueAt, valueEnd);
    }
    i = jsonSkipBlank(object, valueEnd);
    if (i < 0 || i >= length || toI32(object.charCodeAt(i)) !== JSON_COMMA) {
      return null;
    }
    i = jsonSkipBlank(object, i + 1);
  }
  return null;
};
