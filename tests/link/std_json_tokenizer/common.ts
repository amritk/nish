// What the tokenizer's checks share: bytes from a string, a run to the end, a
// verdict as text, and the token stream as text.
import {
  JSON_TOK_ARRAY_BEGIN,
  JSON_TOK_ARRAY_END,
  JSON_TOK_END,
  JSON_TOK_ERR_CONTROL,
  JSON_TOK_ERR_DEPTH,
  JSON_TOK_ERR_ESCAPE,
  JSON_TOK_ERR_NUMBER,
  JSON_TOK_ERR_NUMBER_LIMIT,
  JSON_TOK_ERR_STRING_LIMIT,
  JSON_TOK_ERR_SURROGATE,
  JSON_TOK_ERR_SYNTAX,
  JSON_TOK_ERR_TOTAL_LIMIT,
  JSON_TOK_ERR_TRAILING,
  JSON_TOK_ERR_TRUNCATED,
  JSON_TOK_ERR_UTF8,
  JSON_TOK_ERR_WINDOW,
  JSON_TOK_FALSE,
  JSON_TOK_KEY,
  JSON_TOK_NULL,
  JSON_TOK_NUMBER,
  JSON_TOK_OBJECT_BEGIN,
  JSON_TOK_OBJECT_END,
  JSON_TOK_STRING,
  JSON_TOK_TRUE,
  JsonLimits,
  JsonTokenizer,
} from "../../../std/json-tokenizer";

/** The bytes of `s`, one per `charCodeAt`. */
export const jtBytes = (s: string): u8[] => {
  const n: i32 = toI32(s.length);
  const out = new Array<u8>(n);
  let i: i32 = 0;
  while (i < n && i < toI32(out.length)) {
    out[i] = toU8(toI32(s.charCodeAt(i)));
    i += 1;
  }
  return out;
};

/** The name of a `JSON_TOK_ERR_*` code, or `END` for `JSON_TOK_END`. */
export const jtCodeName = (code: i32): string => {
  switch (code) {
    case JSON_TOK_END:
      return "END";
    case JSON_TOK_ERR_SYNTAX:
      return "SYNTAX";
    case JSON_TOK_ERR_TRUNCATED:
      return "TRUNCATED";
    case JSON_TOK_ERR_TRAILING:
      return "TRAILING";
    case JSON_TOK_ERR_UTF8:
      return "UTF8";
    case JSON_TOK_ERR_ESCAPE:
      return "ESCAPE";
    case JSON_TOK_ERR_SURROGATE:
      return "SURROGATE";
    case JSON_TOK_ERR_CONTROL:
      return "CONTROL";
    case JSON_TOK_ERR_NUMBER:
      return "NUMBER";
    case JSON_TOK_ERR_DEPTH:
      return "DEPTH";
    case JSON_TOK_ERR_STRING_LIMIT:
      return "STRING_LIMIT";
    case JSON_TOK_ERR_NUMBER_LIMIT:
      return "NUMBER_LIMIT";
    case JSON_TOK_ERR_TOTAL_LIMIT:
      return "TOTAL_LIMIT";
    case JSON_TOK_ERR_WINDOW:
      return "WINDOW";
    default:
      return `token ${code}`;
  }
};

/**
 * Calls `next()` until it answers `JSON_TOK_END` or an error, and answers
 * that; `1` when it has not stopped after one call per byte and two more,
 * which a tokenizer that always advances cannot need.
 */
export const jtRun = (t: JsonTokenizer, len: i32): i32 => {
  let steps: i32 = 0;
  let k: i32 = t.next();
  while (k > 0) {
    steps += 1;
    if (steps > len + 2) {
      return 1;
    }
    k = t.next();
  }
  return k;
};

/** `END`, or the error's name and the byte it was found at, for `bytes` read whole under `limits`. */
export const jtVerdictOf = (bytes: u8[], limits: JsonLimits): string => {
  const len: i32 = toI32(bytes.length);
  const t = new JsonTokenizer(bytes, 0, len, limits);
  const k: i32 = jtRun(t, len);
  return k === JSON_TOK_END ? "END" : `${jtCodeName(k)}@${t.errorAt}`;
};

/** `jtVerdictOf` for the bytes of `text` under the default limits. */
export const jtVerdict = (text: string): string => jtVerdictOf(jtBytes(text), new JsonLimits());

/** Lower-case hex of `out[0, n)`. */
export const jtHex = (out: u8[], n: i32): string => {
  const digits = "0123456789abcdef";
  const parts: string[] = [];
  let i: i32 = 0;
  while (i < n && i < toI32(out.length)) {
    const b: i32 = toI32(out[i]);
    parts.push(digits.substring(b >> 4, (b >> 4) + 1));
    parts.push(digits.substring(b & 15, (b & 15) + 1));
    i += 1;
  }
  return parts.join("");
};

/** The current key's or string's decoded bytes as ASCII text, through `stringInto`. */
export const jtText = (t: JsonTokenizer, scratch: u8[]): string => {
  const n: i32 = t.stringInto(scratch, 0);
  const parts: string[] = [];
  let i: i32 = 0;
  while (i < n && i < toI32(scratch.length)) {
    parts.push(String.fromCharCode(toI32(scratch[i])));
    i += 1;
  }
  return parts.join("");
};

/**
 * The current token as one word: `{` `}` `[` `]`, `k:` and `s:` and the text
 * of a key or a string, `n:` and a number as `numberF64` reads it, `t`, `f`
 * and `z` for the literals. With `hex`, a key's or a string's bytes are hex
 * and a number is the decimal of its bits, which is what the Node check in
 * `tests/run.js` reads.
 */
export const jtWord = (t: JsonTokenizer, k: i32, scratch: u8[], hex: boolean): string => {
  switch (k) {
    case JSON_TOK_OBJECT_BEGIN:
      return "{";
    case JSON_TOK_OBJECT_END:
      return "}";
    case JSON_TOK_ARRAY_BEGIN:
      return "[";
    case JSON_TOK_ARRAY_END:
      return "]";
    case JSON_TOK_KEY:
      return hex ? `k:${jtHex(scratch, t.stringInto(scratch, 0))}` : `k:${jtText(t, scratch)}`;
    case JSON_TOK_STRING:
      return hex ? `s:${jtHex(scratch, t.stringInto(scratch, 0))}` : `s:${jtText(t, scratch)}`;
    case JSON_TOK_NUMBER:
      return hex ? `n:${f64ToBits(t.numberF64())}` : `n:${t.numberF64()}`;
    case JSON_TOK_TRUE:
      return "t";
    case JSON_TOK_FALSE:
      return "f";
    case JSON_TOK_NULL:
      return "z";
    default:
      return `?${k}`;
  }
};

/** Every token of `bytes` as words, then the verdict: `[ n:1 ] END`. */
export const jtTokensOf = (bytes: u8[], limits: JsonLimits, hex: boolean): string => {
  const len: i32 = toI32(bytes.length);
  const t = new JsonTokenizer(bytes, 0, len, limits);
  const scratch = new Array<u8>(len);
  const words: string[] = [];
  let steps: i32 = 0;
  let k: i32 = t.next();
  while (k > 0 && steps <= len + 2) {
    words.push(jtWord(t, k, scratch, hex));
    steps += 1;
    k = t.next();
  }
  words.push(k === JSON_TOK_END ? "END" : `${jtCodeName(k)}@${t.errorAt}`);
  return words.join(" ");
};

/** `jtTokensOf` for the bytes of `text` under the default limits, as text. */
export const jtTokens = (text: string): string => jtTokensOf(jtBytes(text), new JsonLimits(), false);
