// A task may wipe a `Secret` it makes: `secret(v)` of a fresh array or record,
// held by a `const` and wiped in the same body, is the task's own storage, so
// its wipe writes nothing another task can see. One task wraps a literal,
// another a `new Array` it fills inside `exposeWith`, a third a record of
// integers; each hands the parent a sum it computed before the wipe. Nothing
// is read after a wipe, so the native threads and Node's one-after-another
// agree, and every byte is written before it is read, as Node needs.
import { expose, exposeWith, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";

class Pair {
  a: u32;
  b: u32;
  constructor(a: u32, b: u32) {
    this.a = a;
    this.b = b;
  }
}

const sum = (k: u8[]): i32 => {
  let t: i32 = 0;
  for (const b of k) {
    t = t + toI32(b);
  }
  return t;
};

const fillFrom = (k: u8[], seed: i32): i32 => {
  for (let i: i32 = 0; i < toI32(k.length); i++) {
    k[i] = toU8(seed + i);
  }
  return sum(k);
};

const both = (p: Pair): i32 => toI32(p.a) * 1000 + toI32(p.b);

const literal = (n: i32): i32 => {
  const k = secret([toU8(n), toU8(n + 1), toU8(n + 2)]);
  const t = expose(k, sum);
  wipe(k);
  return t;
};

const scratch = (n: i32): i32 => {
  const k = secret(new Array<u8>(n));
  const t = exposeWith(k, n, fillFrom);
  wipe(k);
  return t;
};

const record = (n: i32): i32 => {
  const k = secret(new Pair(toU32(n), toU32(n * 2)));
  const t = expose(k, both);
  wipe(k);
  return t;
};

export const main = (): i32 => {
  const out: i32[] = [0, 0, 0, 0, 0, 0];
  {
    using s = scope();
    s.spawn(literal, 4, out, 0);
    s.spawn(literal, 40, out, 1);
    s.spawn(scratch, 8, out, 2);
    s.spawn(scratch, 64, out, 3);
    s.spawn(record, 3, out, 4);
    s.spawn(record, 7, out, 5);
  }
  console.log(`${out[0]} ${out[1]} ${out[2]} ${out[3]}`);
  console.log(`${out[4]} ${out[5]}`);
  return 0;
};
