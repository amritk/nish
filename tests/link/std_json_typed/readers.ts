// `JsonDecoder`'s readers called directly, as the code the compiler writes
// calls them, so that they are held under Node too: `jsonDecode` itself
// cannot run there (`node.ts`), but everything it calls can. `tests/run.js`
// runs this natively and under `runtime/nish.mjs` and holds both to the same
// lines. An `i64` is a BigInt under Node, so a reader that mixed one with a
// number would throw here.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder } from "nish/json-typed";

const bytesOf = (text: string): u8[] => {
  const out = new Array<u8>(toI32(text.length));
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(text.length); i += 1) {
    out[i] = toU8(text.charCodeAt(i));
  }
  return out;
};

/** A decoder over `text`, with its first array element held. */
const opened = (text: string): JsonDecoder => {
  const src = bytesOf(text);
  const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  d.beginArray();
  d.nextElement();
  return d;
};

export const main = (): i32 => {
  const d = opened(
    `[2147483647,-2147483648,4294967295,0,9223372036854775807,-9223372036854775808,"abc",[1,-2],[-9223372036854775808,9223372036854775807]]`
  );
  const a = d.i32();
  d.nextElement();
  const b = d.i32();
  console.log(`i32 ${a} ${b}`);
  d.nextElement();
  const c = d.u32();
  d.nextElement();
  const e = d.u32();
  console.log(`u32 ${c} ${e}`);
  d.nextElement();
  const f = d.i64();
  d.nextElement();
  const g = d.i64();
  console.log(`i64 ${f} ${g}`);
  d.nextElement();
  console.log(`string ${d.string("")}`);
  d.nextElement();
  const xs: i32[] = [];
  const ys = d.i32Array(xs);
  console.log(`i32Array ${ys.length} ${ys[0]} ${ys[1]}`);
  d.nextElement();
  const zs: i64[] = [];
  const ws = d.i64Array(zs);
  console.log(`i64Array ${ws.length} ${ws[0]} ${ws[1]}`);
  console.log(`failed ${d.failed}`);
  const low = opened(`[-2147483649]`);
  low.i32();
  console.log(`i32 below its range ${low.failed} at ${low.errorAt}`);
  const lower = opened(`[-9223372036854775809]`);
  lower.i64();
  console.log(`i64 below its range ${lower.failed} at ${lower.errorAt}`);
  const u = opened(`[-1]`);
  u.u32();
  console.log(`u32 below its range ${u.failed} at ${u.errorAt}`);
  const v = opened(`[4294967296]`);
  v.u32();
  console.log(`u32 above its range ${v.failed} at ${v.errorAt}`);

  const r = opened(`[[7,4294967295],2.5,[1.5,-0.25],true,[true,false],["a","bc"],null,[3]]`);
  const us: u32[] = [];
  const u2 = r.u32Array(us);
  console.log(`u32Array ${u2.length} ${u2[0]} ${u2[1]}`);
  r.nextElement();
  console.log(`f64 ${r.f64()}`);
  r.nextElement();
  const fs: f64[] = [];
  const f2 = r.f64Array(fs);
  console.log(`f64Array ${f2.length} ${f2[0]} ${f2[1]}`);
  r.nextElement();
  console.log(`boolean ${r.boolean()}`);
  r.nextElement();
  const bs: boolean[] = [];
  const b2 = r.booleanArray(bs);
  console.log(`booleanArray ${b2.length} ${b2[0]} ${b2[1]}`);
  r.nextElement();
  const ss: string[] = [];
  const s2 = r.stringArray(ss);
  console.log(`stringArray ${s2.length} ${s2[0]} ${s2[1]}`);
  r.nextElement();
  const none = r.i32ArrayOrNull(null);
  console.log(`i32ArrayOrNull null ${none === null}`);
  r.nextElement();
  const some = r.i32ArrayOrNull(null);
  console.log(`i32ArrayOrNull present ${some !== null ? some.length : -1}`);
  console.log(`failed ${r.failed}`);

  // A string with an escape is unescaped into a buffer first, and one without
  // is copied straight from the input: both end in one `String.fromBytes`.
  const esc = opened(`["x\\u0041\\ty","",["p\\"q","r"]]`);
  const escaped = esc.string("");
  console.log(`string escaped ${escaped.length} ${escaped.charCodeAt(1)} ${escaped.charCodeAt(2)}`);
  esc.nextElement();
  console.log(`string empty [${esc.string("unchanged")}]`);
  esc.nextElement();
  const qs: string[] = [];
  const q2 = esc.stringArray(qs);
  console.log(`stringArray escaped ${q2.length} ${q2[0]} ${q2[1]}`);
  console.log(`failed ${esc.failed}`);

  // Bytes outside ASCII: escapes that decode to two, three and four bytes
  // (é, €, 😀), and raw UTF-8 copied on the fast path. Each byte is one unit
  // under Node, so the length and the sum of the codes agree with a native run.
  const wide = opened(`["\\u00e9","\\u20ac","\\ud83d\\ude00"]`);
  for (let k: i32 = 0; k < 3; k += 1) {
    console.log(`unescaped ${codes(wide.string(""))}`);
    wide.nextElement();
  }
  const raw: u8[] = [91, 34, 99, 97, 102, 195, 169, 34, 93];
  const r8 = new JsonDecoder(raw, 0, toI32(raw.length), new JsonLimits());
  r8.beginArray();
  r8.nextElement();
  console.log(`raw ${codes(r8.string(""))}`);
  // A string whose closing quote is the window's last byte, with bytes the
  // window leaves out on both sides.
  const framed = bytesOf(`xx"edge"yy`);
  const w = new JsonDecoder(framed, 2, 6, new JsonLimits());
  console.log(`window [${w.string("")}] ${w.failed}`);
  return 0;
};

/** A string's byte length and the sum of its codes: the same native and under Node. */
const codes = (s: string): string => {
  let sum: i32 = 0;
  for (let i: i32 = 0; i < toI32(s.length); i += 1) {
    sum += toI32(s.charCodeAt(i));
  }
  return `${s.length} ${sum}`;
};
