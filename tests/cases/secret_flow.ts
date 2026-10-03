// `nish:secret`: the shapes the ownership rules accept. A `Secret` the function
// makes leaves it returned or wiped on every path: `make` returns one, `branch`
// wipes on both arms, `maybe`'s `null` arm holds none to wipe, the loop makes
// and wipes one per pass, `const j = k` moves `k` into `j`, and `secret(raw)`
// moves the local `raw`, which is not read again. A record of integers is a
// payload too: its `wipe` is one volatile `llvm.memset` of the struct's size.
import { Secret, expose, secret, wipe } from "nish:secret";

interface Pair {
  lo: u32;
  hi: u32;
}

const bytes = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8(i + 1);
  }
  return out;
};

const length = (k: u8[]): i32 => toI32(k.length);

const total = (p: Pair): u32 => p.lo + p.hi;

const pairOf = (lo: u32, hi: u32): Pair => {
  const p: Pair = { lo: lo, hi: hi };
  return p;
};

/** A `Secret` returned is a `Secret` moved: the caller owns it. */
const make = (n: i32): Secret<u8[]> => secret(bytes(n));

const maybe = (n: i32): Secret<u8[]> | null => (n > 0 ? make(n) : null);

const branch = (n: i32): i32 => {
  const k: Secret<u8[]> = make(n);
  if (n > 2) {
    const big: i32 = expose(k, length);
    wipe(k);
    return big;
  }
  wipe(k);
  return 0;
};

export const main = (): i32 => {
  console.log(branch(4));
  console.log(branch(1));
  const m: Secret<u8[]> | null = maybe(0);
  if (m === null) {
    console.log("none");
  } else {
    wipe(m);
  }
  let seen: i32 = 0;
  for (let i: i32 = 1; i < 4; i++) {
    const k: Secret<u8[]> = make(i);
    seen = seen + expose(k, length);
    wipe(k);
  }
  console.log(seen);
  const k: Secret<u8[]> = make(2);
  const j: Secret<u8[]> = k;
  console.log(expose(j, length));
  wipe(j);
  const raw: u8[] = bytes(3);
  raw[0] = 9;
  const moved: Secret<u8[]> = secret(raw);
  console.log(expose(moved, length));
  wipe(moved);
  const pair: Secret<Pair> = secret(pairOf(2, 40));
  console.log(expose(pair, total));
  wipe(pair);
  return 0;
};
