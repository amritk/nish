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
  return 0;
};
