// `nish:secret`: `secret(...)` bound with no annotation (#613). The local's
// type is `secret`'s instantiated result, `Secret<u8[]>`, `Secret<Pair>` or
// `Secret<Counter>`, whose struct the copy of `std/secret.ts` minted; this
// module names it through the call alone, and its IR defines it all the same.
// Each payload way in is here: an array literal, `new Array`, a call, a moved
// local, a ternary of two fresh values, a local holding an object literal, a call
// answering an interface and a `new`; each is exposed and wiped.
import { expose, secret, wipe } from "nish:secret";

interface Pair {
  lo: u32;
  hi: u32;
}

class Counter {
  hits: i64;
  misses: i64;
  constructor(hits: i64, misses: i64) {
    this.hits = hits;
    this.misses = misses;
  }
}

const bytes = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8(i + 1);
  }
  return out;
};

const pairOf = (lo: u32, hi: u32): Pair => {
  const p: Pair = { lo: lo, hi: hi };
  return p;
};

const sum = (k: u8[]): i32 => {
  let s: i32 = 0;
  for (const b of k) {
    s = s + toI32(b);
  }
  return s;
};

const words = (k: u32[]): i32 => toI32(k.length);

const total = (p: Pair): u32 => p.lo + p.hi;

const seen = (c: Counter): i64 => c.hits + c.misses;

export const main = (): i32 => {
  const literal = secret([1, 2, 3]);
  console.log(expose(literal, (k: i32[]): i32 => k.length));
  wipe(literal);
  let fresh = secret(new Array<u32>(5));
  console.log(expose(fresh, words));
  wipe(fresh);
  const called = secret(bytes(4));
  console.log(expose(called, sum));
  wipe(called);
  const raw = bytes(3);
  raw[0] = 9;
  const moved = secret(raw);
  console.log(expose(moved, sum));
  wipe(moved);
  const n: i32 = toI32(process.argv.length);
  const picked = secret(n > 0 ? bytes(2) : bytes(5));
  console.log(expose(picked, sum));
  wipe(picked);
  const plain: Pair = { lo: toU32(2), hi: toU32(40) };
  const record = secret(plain);
  console.log(expose(record, total));
  wipe(record);
  const made = secret(pairOf(7, 8));
  console.log(expose(made, total));
  wipe(made);
  const counter = secret(new Counter(3, 4));
  console.log(expose(counter, seen));
  wipe(counter);
  return 0;
};
