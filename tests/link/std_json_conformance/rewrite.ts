// The rewrite every check in tests/link/std_json_conformance is built on: a JSON
// text read by nish/json-tokenizer and written back by nish/json's JsonWriter,
// and the packed spelling its inputs and answers travel in, where every byte
// outside `!` to `~`, and every `%`, is `%XX` (tests/json-suite/pack.js).
//
// This module imports only by `nish/` specifier and declares no `main`, so that
// it also loads under Node's prelude (runtime/nish.mjs), which resolves nothing
// else: tests/run.js calls `jcPrintRewrites` there and natively (main.ts
// `--rewrite`), and holds both to JSON.stringify(JSON.parse(x)). Every string
// is one byte per character on both sides, a decoded UTF-8 byte being one
// `String.fromCharCode` and the writer writing each `charCodeAt` back as one
// byte, so the packed answer is the same bytes under Node as natively.
import { JSON_WRITE_FULL, JsonWriter } from "nish/json";
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
} from "nish/json-tokenizer";
import { splitLines } from "nish/text";

/** JSONTestSuite's corpus, packed one file per line, from the repository root. */
export const JC_SUITE_PATH: string = "tests/json-suite/test-parsing.txt";

/**
 * How large a rewrite's buffer may grow. A number can write back far longer
 * than it is written (`1e300` is 301 digits), so the buffer starts at twice the
 * input and is grown on `JSON_WRITE_FULL` up to this.
 */
const JC_MAX_OUT: i32 = 67108864;

/** The value of one upper-case hex digit, as the packed spelling writes them, or `-1`. */
const jcHexValue = (c: i32): i32 => {
  const zero: i32 = 48;
  const nine: i32 = 57;
  const upperA: i32 = 65;
  const upperF: i32 = 70;
  if (c >= zero && c <= nine) {
    return c - zero;
  }
  if (c >= upperA && c <= upperF) {
    return c - upperA + 10;
  }
  return -1;
};

/** The bytes a packed field spells, `%XX` decoded; `null` when an escape is malformed. */
export const jcUnpack = (text: string): u8[] | null => {
  const percent: i32 = 37;
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  let i: i32 = 0;
  while (i < n) {
    const c: i32 = toI32(text.charCodeAt(i));
    if (c !== percent) {
      out.push(toU8(c));
      i += 1;
      continue;
    }
    if (i + 2 >= n) {
      return null;
    }
    const hi: i32 = jcHexValue(toI32(text.charCodeAt(i + 1)));
    const lo: i32 = jcHexValue(toI32(text.charCodeAt(i + 2)));
    if (hi < 0 || lo < 0) {
      return null;
    }
    out.push(toU8(hi * 16 + lo));
    i += 3;
  }
  return out;
};

/** `bytes[0, n)` in the packed spelling. */
export const jcPack = (bytes: u8[], n: i32): string => {
  const digits = "0123456789ABCDEF";
  const percent: i32 = 37;
  const parts: string[] = [];
  let i: i32 = 0;
  while (i < n && i < toI32(bytes.length)) {
    const b: i32 = toI32(bytes[i]);
    if (b > 32 && b < 127 && b !== percent) {
      parts.push(String.fromCharCode(b));
    } else {
      parts.push(`%${digits.substring(b >> 4, (b >> 4) + 1)}${digits.substring(b & 15, (b & 15) + 1)}`);
    }
    i += 1;
  }
  return parts.join("");
};

/** The name of a `JSON_TOK_ERR_*` code. */
export const jcTokenError = (code: i32): string => {
  switch (code) {
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
 * The name of a `JsonWriter.failed` code, `write ` and the constant's suffix,
 * so that a writer's refusal never reads as a tokenizer's.
 */
const jcWriteError = (code: i32): string => {
  const names: string[] = ["OK", "KEY_EXPECTED", "VALUE_EXPECTED", "UNBALANCED", "TOO_DEEP", "FULL", "DONE", "BAD_WINDOW"];
  return code <= 0 && -code < toI32(names.length) ? `write ${names[-code]}` : `write ${code}`;
};

/** The current key's or string's decoded bytes, one character per byte. */
export const jcText = (t: JsonTokenizer, scratch: u8[]): string => {
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
 * One token, as the writer writes it. Every number is written as the double
 * `numberF64` reads, because that is the number `JSON.parse` gives
 * `JSON.stringify`: `9007199254740993` writes back as `9007199254740992`.
 */
const jcWriteToken = (t: JsonTokenizer, k: i32, w: JsonWriter, scratch: u8[]): void => {
  switch (k) {
    case JSON_TOK_OBJECT_BEGIN:
      w.beginObject();
      break;
    case JSON_TOK_OBJECT_END:
      w.endObject();
      break;
    case JSON_TOK_ARRAY_BEGIN:
      w.beginArray();
      break;
    case JSON_TOK_ARRAY_END:
      w.endArray();
      break;
    case JSON_TOK_KEY:
      w.key(jcText(t, scratch));
      break;
    case JSON_TOK_STRING:
      w.string(jcText(t, scratch));
      break;
    case JSON_TOK_NUMBER:
      w.f64(t.numberF64());
      break;
    case JSON_TOK_TRUE:
      w.boolean(true);
      break;
    case JSON_TOK_FALSE:
      w.boolean(false);
      break;
    case JSON_TOK_NULL:
      w.nullValue();
      break;
    default:
      break;
  }
};

/** What one rewrite came to: `error` is empty and `out[0, len)` the text, or `error` names what stopped it. */
export class JcOutcome {
  error: string;
  out: u8[];
  len: i32;

  constructor(error: string, out: u8[], len: i32) {
    this.error = error;
    this.out = out;
    this.len = len;
  }
}

/** Every token of `src` through `w`; answers the tokenizer's last code, `JSON_TOK_END` or an error. */
const jcCopyTokens = (src: u8[], w: JsonWriter): i32 => {
  const len: i32 = toI32(src.length);
  const t = new JsonTokenizer(src, 0, len, new JsonLimits());
  const scratch = new Array<u8>(len);
  let k: i32 = t.next();
  while (k > 0) {
    jcWriteToken(t, k, w, scratch);
    k = t.next();
  }
  return k;
};

/** `src` read by the tokenizer and written back by the writer, minified. */
export const jcRewrite = (src: u8[]): JcOutcome => {
  let cap: i32 = 2 * toI32(src.length) + 64;
  while (true) {
    const out = new Array<u8>(cap);
    const w = new JsonWriter(out, 0);
    const k: i32 = jcCopyTokens(src, w);
    if (k !== JSON_TOK_END) {
      return new JcOutcome(jcTokenError(k), out, 0);
    }
    if (w.failed === JSON_WRITE_FULL && cap < JC_MAX_OUT) {
      cap = cap * 4;
      continue;
    }
    return w.complete() ? new JcOutcome("", out, w.end) : new JcOutcome(jcWriteError(w.failed), out, 0);
  }
};

/**
 * Every value of the stringify words `input` (`tests/json-conformance/extract.js`
 * gives the spelling) through `w`; answers `""`, or the tokenizer's error for a
 * string or number word it refuses. A string word is a JSON string literal and
 * a number word a JSON number, each read by a tokenizer of its own, and every
 * number is written as the double it is, as a JavaScript number is.
 */
const jcWriteWords = (input: string, w: JsonWriter, scratch: u8[]): string => {
  const space: i32 = 32;
  const n: i32 = toI32(input.length);
  let start: i32 = 0;
  while (start < n) {
    let end: i32 = start;
    while (end >= 0 && end < n && toI32(input.charCodeAt(end)) !== space) {
      end += 1;
    }
    const word = input.slice(start, end);
    start = end + 1;
    if (word === "[") {
      w.beginArray();
    } else if (word === "]") {
      w.endArray();
    } else if (word === "{") {
      w.beginObject();
    } else if (word === "}") {
      w.endObject();
    } else if (word === "t" || word === "f") {
      w.boolean(word === "t");
    } else if (word === "z") {
      w.nullValue();
    } else if (word === "n:NaN") {
      w.f64(toF64(0) / toF64(0));
    } else if (word === "n:Infinity" || word === "n:-Infinity") {
      w.f64((word === "n:Infinity" ? toF64(1) : toF64(-1)) / toF64(0));
    } else {
      const bytes: u8[] = [];
      for (let i: i32 = 2; i < toI32(word.length); i += 1) {
        bytes.push(toU8(toI32(word.charCodeAt(i))));
      }
      const t = new JsonTokenizer(bytes, 0, toI32(bytes.length), new JsonLimits());
      const k: i32 = t.next();
      if (k < 0) {
        return jcTokenError(k);
      }
      if (word.startsWith("n:")) {
        w.f64(t.numberF64());
      } else if (word.startsWith("k:")) {
        w.key(jcText(t, scratch));
      } else {
        w.string(jcText(t, scratch));
      }
    }
  }
  return "";
};

/** The value the stringify words `input` spell, written by the writer, minified. */
export const jcStringify = (input: string): JcOutcome => {
  let cap: i32 = 2 * toI32(input.length) + 64;
  const scratch = new Array<u8>(toI32(input.length));
  while (true) {
    const out = new Array<u8>(cap);
    const w = new JsonWriter(out, 0);
    const error = jcWriteWords(input, w, scratch);
    if (error !== "") {
      return new JcOutcome(error, out, 0);
    }
    if (w.failed === JSON_WRITE_FULL && cap < JC_MAX_OUT) {
      cap = cap * 4;
      continue;
    }
    return w.complete() ? new JcOutcome("", out, w.end) : new JcOutcome(jcWriteError(w.failed), out, 0);
  }
};

/**
 * Prints `<name> <rewrite>` for every y_ file of JSONTestSuite, the rewrite
 * packed, or `<name> !<error>` for one the rewrite refuses; answers 1 when the
 * corpus does not read. This is what tests/run.js holds to
 * JSON.stringify(JSON.parse(x)), under Node and natively.
 */
export const jcPrintRewrites = (): number => {
  const text = readFileSyncOrNull(JC_SUITE_PATH);
  if (text === null) {
    return 1;
  }
  for (const line of splitLines(text)) {
    if (!line.startsWith("y_")) {
      continue;
    }
    const space: i32 = toI32(line.indexOf(" "));
    const bytes: u8[] | null = space > 0 ? jcUnpack(line.slice(space + 1)) : null;
    if (bytes === null) {
      return 1;
    }
    const o = jcRewrite(bytes);
    console.log(o.error === "" ? `${line.slice(0, space)} ${jcPack(o.out, o.len)}` : `${line.slice(0, space)} !${o.error}`);
  }
  return 0;
};
