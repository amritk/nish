// A string and a number longer than a `u16` holds, read through
// `nish/json-typed`, where `jsonTypedZeroBytes` grows its buffer a byte at a
// time instead of taking one `new Array`; and the array readers reusing an
// array, then growing one past its old length and shrinking another below it.
// `args` passes `--allow-panics`: `String.fromBytes` keeps the `slice` site its
// readers reach (std/json-typed.ts, `JsonNumber.text` and `JsonDecoder.text`).
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, JsonNumber } from "nish/json-typed";

/** 70,000 bytes, past the 65,535 a `u16` length reaches. */
const LONG: i32 = 70000;

const opened = (src: u8[], limits: JsonLimits): JsonDecoder => {
  const d = new JsonDecoder(src, 0, toI32(src.length), limits);
  d.beginArray();
  d.nextElement();
  return d;
};

/** `["\n" then LONG - 1 'a's]`, whose escape sends the string through the unescaped copy. */
const longString = (): u8[] => {
  const src: u8[] = [91, 34, 92, 110];
  for (let k: i32 = 1; k < LONG; k += 1) {
    src.push(97);
  }
  src.push(34);
  src.push(93);
  return src;
};

const joined = (xs: i32[]): string => {
  const parts: string[] = [];
  for (const x of xs) {
    parts.push(`${x}`);
  }
  return parts.join(",");
};

const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < toI32(text.length); k += 1) {
    out.push(toU8(toI32(text.charCodeAt(k)) & 127));
  }
  return out;
};

export const main = (): i32 => {
  const limits = new JsonLimits();
  limits.maxStringBytes = LONG + 8;
  const d = opened(longString(), limits);
  const s = d.string("");
  let as: i32 = 0;
  for (let k: i32 = 0; k < toI32(s.length); k += 1) {
    if (s.charCodeAt(k) === 97) {
      as += 1;
    }
  }
  console.log(`long string ${s.length} ${s.charCodeAt(0)} ${as} ${d.failed}`);

  const ones: string[] = [];
  for (let k: i32 = 0; k < LONG; k += 1) {
    ones.push("1");
  }
  const digits = ones.join("");
  const n = new JsonNumber();
  console.log(`long setText ${n.setText(digits)} ${n.text().length} ${n.text().charCodeAt(69999)}`);

  const xs: i32[] = [9, 9, 9];
  const grow = opened(ascii("[[1,2,3,4,5]]"), new JsonLimits());
  const grown = grow.i32Array(xs);
  console.log(`grow ${grown.length} ${joined(grown)} ${grow.failed}`);
  const shrink = opened(ascii("[[7]]"), new JsonLimits());
  const shrunk = shrink.i32Array(grown);
  console.log(`shrink ${shrunk.length} ${joined(shrunk)} ${shrink.failed}`);
  const names: string[] = ["x"];
  const more = opened(ascii('[["p","q","r"]]'), new JsonLimits());
  const named = more.stringArray(names);
  console.log(`strings ${named.length} ${named.join(",")} ${more.failed}`);
  return 0;
};
