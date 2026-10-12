// `JsonDecoder`'s readers called directly, as the code the compiler writes
// calls them, so that they are held under Node too: `jsonDecode` itself
// cannot run there (`node.ts`), but everything it calls can. `tests/run.js`
// runs this natively and under `runtime/nish.mjs` and holds both to the same
// lines. An `i64` is a BigInt under Node, so a reader that mixed one with a
// number would throw here.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import {
  JsonDecoder,
  JsonNumber,
  jsonEncodeNumber,
  jsonEncodeU64,
  jsonEncodeU64Array,
  jsonEncodeU64ArrayOrNull,
} from "nish/json-typed";

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

  // `u64` at both ends and past them; a `u64` is a BigInt under Node.
  const n = opened(`[0,18446744073709551615,9223372036854775808,[1,18446744073709551615],null,[7]]`);
  const n0 = n.u64();
  n.nextElement();
  const n1 = n.u64();
  n.nextElement();
  const n2 = n.u64();
  console.log(`u64 ${n0} ${n1} ${n2}`);
  n.nextElement();
  const ux: u64[] = [];
  const n3 = n.u64Array(ux);
  console.log(`u64Array ${n3.length} ${n3[0]} ${n3[1]}`);
  n.nextElement();
  const n4 = n.u64ArrayOrNull(null);
  console.log(`u64ArrayOrNull null ${n4 === null}`);
  n.nextElement();
  const n5 = n.u64ArrayOrNull(null);
  console.log(`u64ArrayOrNull present ${n5 !== null ? n5.length : -1} ${n.failed}`);
  for (const bad of ["[18446744073709551616]", "[-1]", "[-0]", "[1.5]", `["1"]`]) {
    const b = opened(bad);
    b.u64();
    console.log(`u64 ${bad} ${b.failed} at ${b.errorAt}`);
  }

  // The current key: its length, a byte of it, and the key itself, raw and
  // through escapes of two, three and four bytes.
  const keys = bytesOf(`{"ab":1,"\\u00e9\\u20ac\\ud83d\\ude00":2}`);
  const k = new JsonDecoder(keys, 0, toI32(keys.length), new JsonLimits());
  k.beginObject();
  k.nextField();
  console.log(`key ${k.key()} ${k.keyLength()} ${k.keyByte(0)} ${k.keyByte(1)} ${k.keyByte(2)} ${k.keyByte(-1)}`);
  k.i32();
  k.nextField();
  console.log(`key escaped ${codes(k.key())} ${k.keyLength()} ${k.keyByte(0)}`);
  console.log(`text ${codes(k.text())} ${k.failed}`);

  // The `u64` encoders, every value through the one digit loop: 0, 2^64 - 1
  // and 2^63, alone and in arrays. Then `mapRoom` at either side of a limit.
  const out = new JsonWriter(new Array<u8>(256), 0);
  out.beginArray();
  jsonEncodeU64(out, n0);
  jsonEncodeU64(out, n1);
  jsonEncodeU64(out, n2);
  jsonEncodeU64Array(out, n3);
  jsonEncodeU64ArrayOrNull(out, null);
  jsonEncodeU64ArrayOrNull(out, n5);
  out.endArray();
  console.log(`encoded ${out.text()} ${out.failed}`);
  const room = new JsonDecoder(keys, 0, toI32(keys.length), new JsonLimits());
  room.maxMapKeys = 2;
  room.beginObject();
  room.nextField();
  console.log(`mapRoom ${room.mapRoom(1)} ${room.mapRoom(2)} ${room.failed} at ${room.errorAt}`);
  numbers();
  return 0;
};

/**
 * `JsonNumber`: read whole by `number`, kept as written, read back as each
 * type `nish/json-value` reads a number as, set from text, and written byte
 * for byte by `jsonEncodeNumber`.
 */
const numbers = (): void => {
  const d = opened(`[123456789012345678901234567890,-0,18446744073709551615,-9223372036854775808,2.5e-3,"7",1]`);
  const n = new JsonNumber();
  console.log(`number new ${n.text()} ${n.isI64()} ${n.i64()} ${n.isU64()} ${n.u64()}`);
  d.number(n);
  console.log(`number ${n.text()} ${n.isI64()} ${n.isU64()} ${n.f64() > 1.2e29 && n.f64() < 1.3e29}`);
  d.nextElement();
  d.number(n);
  console.log(`number ${n.text()} ${n.isI64()} ${n.i64()} ${n.isU64()}`);
  d.nextElement();
  d.number(n);
  console.log(`number ${n.text()} ${n.isI64()} ${n.isU64()} ${n.u64()}`);
  d.nextElement();
  d.number(n);
  console.log(`number ${n.text()} ${n.isI64()} ${n.i64()} ${n.isU64()} ${n.u64()}`);
  d.nextElement();
  d.number(n);
  console.log(`number ${n.text()} ${n.isI64()} ${n.f64() === 0.0025}`);
  d.nextElement();
  d.number(n);
  console.log(`number a string ${d.failed} at ${d.errorAt}, keeps ${n.text()}`);
  const shorter = opened(`[123456,7]`);
  shorter.number(n);
  shorter.nextElement();
  shorter.number(n);
  console.log(`number shorter ${n.text()} ${n.count} ${shorter.failed}`);
  const set: string[] = [];
  for (const text of ["1e5", "01", " 1", "1 ", "-", "\u00e9", "", "-1.5E-7"]) {
    set.push(`${n.setText(text)}:${n.text()}`);
  }
  console.log(`setText ${set.join(" ")}`);
  const out = new JsonWriter(new Array<u8>(128), 0);
  out.beginArray();
  jsonEncodeNumber(out, n);
  const wide = new JsonNumber();
  wide.setText("-123456789012345678901234567890.000000000000000000001e-99999");
  jsonEncodeNumber(out, wide);
  out.endArray();
  console.log(`number encoded ${out.text()} ${out.failed}`);
};

/** A string's byte length and the sum of its codes: the same native and under Node. */
const codes = (s: string): string => {
  let sum: i32 = 0;
  for (let i: i32 = 0; i < toI32(s.length); i += 1) {
    sum += toI32(s.charCodeAt(i));
  }
  return `${s.length} ${sum}`;
};
