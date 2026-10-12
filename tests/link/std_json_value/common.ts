// What the json-value checks share: bytes from a string and back as hex,
// JSONTestSuite's corpus, the tokenizer's own verdict on a text, and the
// tokenizer's canonical form of one, which a parse and a write must give back.
import { JSON_WRITE_FULL, JsonWriter } from "nish/json";
import {
  JSON_TOK_ARRAY_BEGIN,
  JSON_TOK_ARRAY_END,
  JSON_TOK_END,
  JSON_TOK_FALSE,
  JSON_TOK_KEY,
  JSON_TOK_NULL,
  JSON_TOK_NUMBER,
  JSON_TOK_OBJECT_BEGIN,
  JSON_TOK_OBJECT_END,
  JSON_TOK_STRING,
  JsonLimits,
  JsonTokenizer,
} from "nish/json-tokenizer";
import { splitLines } from "nish/text";

/** The bytes of `s`, one per `charCodeAt`. */
export const jvBytes = (s: string): u8[] => {
  const n: i32 = toI32(s.length);
  const out = new Array<u8>(n);
  for (let i: i32 = 0; i < n && i < toI32(out.length); i += 1) {
    out[i] = toU8(toI32(s.charCodeAt(i)));
  }
  return out;
};

/** `bytes[0, n)` as lower-case hex. */
export const jvHex = (bytes: u8[], n: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < n && i < toI32(bytes.length); i += 1) {
    const b: i32 = toI32(bytes[i]);
    const hi: i32 = b >> 4;
    const lo: i32 = b & 15;
    parts.push(String.fromCharCode(hi < 10 ? 48 + hi : 87 + hi));
    parts.push(String.fromCharCode(lo < 10 ? 48 + lo : 87 + lo));
  }
  return parts.join("");
};

/** The bytes of `s` as hex: what a native string holds, for an exact check of non-ASCII text. */
export const jvHexOf = (s: string): string => jvHex(jvBytes(s), toI32(s.length));

/** One file of JSONTestSuite's corpus: its upstream name and its bytes. */
export class JvCase {
  name: string;
  bytes: u8[];

  constructor(name: string, bytes: u8[]) {
    this.name = name;
    this.bytes = bytes;
  }
}

/** The value of one upper-case hex digit, as tests/json-suite/pack.js writes them, or `-1`. */
const jvHexValue = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48;
  }
  if (c >= 65 && c <= 70) {
    return c - 65 + 10;
  }
  return -1;
};

/** Every file of tests/json-suite/test-parsing.txt, `%XX` decoded; empty when it is missing or malformed. */
export const jvLoadCorpus = (): JvCase[] => {
  const cases: JvCase[] = [];
  const text = readFileSyncOrNull("tests/json-suite/test-parsing.txt");
  if (text === null) {
    return cases;
  }
  for (const line of splitLines(text)) {
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const space: i32 = toI32(line.indexOf(" "));
    if (space <= 0) {
      return [];
    }
    const packed = line.slice(space + 1);
    const n: i32 = toI32(packed.length);
    const out: u8[] = [];
    let i: i32 = 0;
    while (i < n) {
      const c: i32 = toI32(packed.charCodeAt(i));
      if (c !== 37) {
        out.push(toU8(c));
        i += 1;
        continue;
      }
      const hi: i32 = i + 1 < n ? jvHexValue(toI32(packed.charCodeAt(i + 1))) : -1;
      const lo: i32 = i + 2 < n ? jvHexValue(toI32(packed.charCodeAt(i + 2))) : -1;
      if (hi < 0 || lo < 0) {
        return [];
      }
      out.push(toU8(hi * 16 + lo));
      i += 3;
    }
    cases.push(new JvCase(line.slice(0, space), out));
  }
  return cases;
};

/** The tokenizer's verdict on `src[off, off + len)`: `code@errorAt`, or `0@-1` when the window is one valid text. */
export const jvTokVerdict = (src: u8[], off: i32, len: i32, limits: JsonLimits): string => {
  const tok = new JsonTokenizer(src, off, len, limits);
  let k: i32 = tok.next();
  while (k > 0) {
    k = tok.next();
  }
  return k === JSON_TOK_END ? "0@-1" : `${k}@${tok.errorAt}`;
};

/**
 * The tokenizer's canonical form of a valid text: every token written straight
 * into a `JsonWriter` as it goes by, strings decoded and written again, numbers
 * copied as their text. It keeps a repeated key, which a parse does not, so it
 * is the form of every text with no duplicate key. `""` when the text is not
 * valid or does not fit `cap` bytes.
 */
export const jvCanonical = (src: u8[], cap: i32): string => {
  const tok = new JsonTokenizer(src, 0, toI32(src.length), new JsonLimits());
  const out = new Array<u8>(cap);
  const w = new JsonWriter(out, 0);
  const scratch = new Array<u8>(toI32(src.length));
  let k: i32 = tok.next();
  while (k > 0) {
    if (k === JSON_TOK_OBJECT_BEGIN) {
      w.beginObject();
    } else if (k === JSON_TOK_OBJECT_END) {
      w.endObject();
    } else if (k === JSON_TOK_ARRAY_BEGIN) {
      w.beginArray();
    } else if (k === JSON_TOK_ARRAY_END) {
      w.endArray();
    } else if (k === JSON_TOK_KEY || k === JSON_TOK_STRING) {
      const n: i32 = tok.stringInto(scratch, 0);
      const s = n > 0 ? String.fromBytes(scratch, 0, n) : "";
      if (k === JSON_TOK_KEY) {
        w.key(s);
      } else {
        w.string(s);
      }
    } else if (k === JSON_TOK_NUMBER) {
      w.raw(tok.src, tok.tokStart, tok.tokEnd - tok.tokStart);
    } else if (k === JSON_TOK_NULL) {
      w.nullValue();
    } else {
      w.boolean(k !== JSON_TOK_FALSE);
    }
    k = tok.next();
  }
  if (k !== JSON_TOK_END || w.failed === JSON_WRITE_FULL || !w.complete()) {
    return "";
  }
  return String.fromBytes(out, 0, w.end);
};
