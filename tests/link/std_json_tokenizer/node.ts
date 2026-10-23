// `nish/json-tokenizer` under Node, through runtime/nish.mjs: the module has to
// load there, since the typed layer's Node differential imports it, so it may
// hold no construct Node 22 cannot parse (a `using` declaration, for one).
// tests/run.js runs this file under the prelude and holds what it prints to a
// line it spells out. It imports only by `nish/` specifier, which the prelude
// resolves; main.ts, the native program, does not import it.
import { JSON_TOK_KEY, JSON_TOK_NUMBER, JSON_TOK_STRING, JsonLimits, JsonTokenizer } from "nish/json-tokenizer";

/** The bytes of an ASCII `s`. */
const nodeBytes = (s: string): u8[] => {
  const out: u8[] = [];
  let i: i32 = 0;
  while (i < toI32(s.length)) {
    out.push(toU8(toI32(s.charCodeAt(i))));
    i += 1;
  }
  return out;
};

/** Lower-case hex of `out[0, n)`. */
const nodeHex = (out: u8[], n: i32): string => {
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

/**
 * Every token's kind; a key's or a string's decoded bytes in hex, and for a
 * key whether `keyEquals` holds for "ab" (`=`) or not (`!`); a number's value,
 * its `i64` after `/` when it is one, and its `u64` after `+` when it is one;
 * then the verdict.
 */
const nodeTokens = (text: string): string => {
  const bytes = nodeBytes(text);
  const t = new JsonTokenizer(bytes, 0, toI32(bytes.length), new JsonLimits());
  const out = new Array<u8>(toI32(bytes.length));
  const words: string[] = [];
  let k: i32 = t.next();
  while (k > 0) {
    if (k === JSON_TOK_NUMBER) {
      const signed = t.isInteger() ? `/${t.numberI64()}` : "";
      const unsigned = t.isU64() ? `+${t.numberU64()}` : "";
      words.push(`${k}:${t.numberF64()}${signed}${unsigned}`);
    } else if (k === JSON_TOK_STRING) {
      words.push(`${k}:${nodeHex(out, t.stringInto(out, 0))}`);
    } else if (k === JSON_TOK_KEY) {
      words.push(`${k}:${nodeHex(out, t.stringInto(out, 0))}${t.keyEquals("ab") ? "=" : "!"}`);
    } else {
      words.push(`${k}`);
    }
    k = t.next();
  }
  words.push(`${k}@${t.errorAt}`);
  return words.join(" ");
};

export const main = (): number => {
  // ASCII only, so that bytes and UTF-16 code units agree, with an escaped
  // surrogate pair (U+1F600) that decodes to four UTF-8 bytes; `keyEquals` is
  // asked of an escaped key that matches and one that does not. 1e23 and the
  // 17-digit number take the Eisel-Lemire path, and the numbers of 20 digits
  // below take parseFloat.
  console.log(nodeTokens('{"a\\u0062":[1,-2.5e1,"x\\n\\u0041\\ud83d\\ude00",true,false,null,{}],"ac":1e23,"long":0.12345678901234567}'));
  console.log(nodeTokens("[-9223372036854775808,9223372036854775808,-0]"));
  console.log(nodeTokens("[1,]"));
  // `numberU64` at the edges of a u64: 2^64 - 1 and one past it, 10^19, the
  // first number of 20 digits, and 10^19 - 1, the last of 19.
  console.log(
    nodeTokens("[18446744073709551615,18446744073709551616,10000000000000000000,9999999999999999999,0]")
  );
  return 0;
};
