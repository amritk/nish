// `nish/json-tokenizer` under Node, through runtime/nish.mjs: the module has to
// load there, since the typed layer's Node differential imports it, so it may
// hold no construct Node 22 cannot parse (a `using` declaration, for one).
// tests/run.js runs this file under the prelude and holds what it prints to a
// line it spells out. It imports only by `nish/` specifier, which the prelude
// resolves; main.ts, the native program, does not import it.
import { JSON_TOK_NUMBER, JSON_TOK_STRING, JsonLimits, JsonTokenizer } from "nish/json-tokenizer";

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

/** Every token's kind, a string's decoded length, a number's value (and its `i64` when it is one), then the verdict. */
const nodeTokens = (text: string): string => {
  const bytes = nodeBytes(text);
  const t = new JsonTokenizer(bytes, 0, toI32(bytes.length), new JsonLimits());
  const out = new Array<u8>(toI32(bytes.length));
  const words: string[] = [];
  let k: i32 = t.next();
  while (k > 0) {
    if (k === JSON_TOK_NUMBER) {
      words.push(t.isInteger() ? `${k}:${t.numberF64()}/${t.numberI64()}` : `${k}:${t.numberF64()}`);
    } else if (k === JSON_TOK_STRING) {
      words.push(`${k}:${t.stringInto(out, 0)}`);
    } else {
      words.push(`${k}`);
    }
    k = t.next();
  }
  words.push(`${k}@${t.errorAt}`);
  return words.join(" ");
};

export const main = (): number => {
  // ASCII only, so that bytes and UTF-16 code units agree; 1e23 and the
  // 17-digit number take the parseFloat path.
  console.log(nodeTokens('{"a":[1,-2.5e1,"x\\n\\u0041",true,false,null,{}],"big":1e23,"long":0.12345678901234567}'));
  console.log(nodeTokens("[-9223372036854775808,9223372036854775808,-0]"));
  console.log(nodeTokens("[1,]"));
  return 0;
};
