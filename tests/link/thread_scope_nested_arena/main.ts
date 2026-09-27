// WP29 P2: a scope nests inside the arena bracket and other scopes nest in it.
// Each task's argument is a string built in a loop inside the scope's block; it
// is read when the scope joins, so the pass that built it must not give it back
// first, and a `spawn`'s argument escapes into its task for exactly that reason.
// An inner scope opens and joins inside the outer one's block, before its first
// spawn, and the whole loop runs in a function whose own arena scope releases
// last, three rounds over.
import { scope } from "nish/threads";

/** How many decimal digits `s` holds. */
const digits = (s: string): i32 => {
  let n: i32 = 0;
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    const c: i32 = toI32(s.charCodeAt(i));
    if (c >= 48 && c <= 57) {
      n = n + 1;
    }
  }
  return n;
};

const label = (k: i32): string => `row ${k * k * k * 999} of ${k}`;

const counts = (): i32 => {
  const out: i32[] = [0, 0, 0, 0];
  const inner: i32[] = [0];
  {
    using s = scope();
    {
      using t = scope();
      t.spawn(digits, label(9), inner, 0);
    }
    for (let k: i32 = 0; k < 4; k++) {
      s.spawn(digits, label(k + 1), out, k);
    }
  }
  console.log(`inner ${inner[0]}`);
  console.log(`${out[0]} ${out[1]} ${out[2]} ${out[3]}`);
  return out[3] - out[0];
};

export const main = (): i32 => {
  let last: i32 = 0;
  for (let round: i32 = 0; round < 3; round++) {
    last = counts();
  }
  console.log(`${last}`);
  return 0;
};
