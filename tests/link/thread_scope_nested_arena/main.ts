// WP29 P2: a scope nests inside the arena bracket and other scopes nest in it.
// Each task's argument is an array allocated in a loop inside the scope's block;
// it is read when the scope joins, so the pass that allocated it must not give it
// back first, and a `spawn`'s argument escapes into its task for exactly that
// reason. The inner scope joins at its own block's end, inside the outer one,
// and the whole loop runs in a function whose own arena scope releases last.
import { scope } from "nish/threads";

const total = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

const row = (k: i32): i32[] => {
  const r: i32[] = [];
  for (let i: i32 = 0; i < 1000; i++) {
    r.push(k * i);
  }
  return r;
};

const sums = (): i32 => {
  const out: i32[] = [0, 0, 0, 0];
  const inner: i32[] = [0];
  {
    using s = scope();
    for (let k: i32 = 0; k < 4; k++) {
      s.spawn(total, row(k + 1), out, k);
    }
    {
      using t = scope();
      t.spawn(total, row(10), inner, 0);
    }
    console.log(`inner ${inner[0]}`);
  }
  console.log(`${out[0]} ${out[1]} ${out[2]} ${out[3]}`);
  return out[3] - out[0];
};

export const main = (): i32 => {
  let last: i32 = 0;
  for (let round: i32 = 0; round < 3; round++) {
    last = sums();
  }
  console.log(`${last}`);
  return 0;
};
