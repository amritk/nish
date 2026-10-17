// A map inside a `using a = arena()` block: the region joins before the map
// returns, so the result array it allocates is the block's alone, and the
// block's release frees it when the block ends. Only the number leaves. A map
// that answers strings may sit in the block too: the blocks of strings it
// adopts from its workers are the block's newest memory, and go with it.
import { parallelMap } from "nish/threads";

const sumScaled = (xs: i32[], k: i32): i32 => {
  let s = 0;
  {
    using a = arena();
    const ys = parallelMap(xs, (x) => x * k);
    for (const y of ys) {
      s = (s + y) % 1000003;
    }
  }
  return s;
};

const wordLengths = (xs: i32[], k: i32): i32 => {
  let s = 0;
  {
    using a = arena();
    const ws = parallelMap(xs, (x) => `w${x + k}`);
    for (const w of ws) {
      s = (s + w.length + w.charCodeAt(w.length - 1)) % 1000003;
    }
  }
  return s;
};

export const main = (): i32 => {
  const xs: i32[] = [];
  for (let i = 0; i < 1000; i++) {
    xs.push(i);
  }
  let c = 0;
  for (let r = 0; r < 5; r++) {
    c = (c + sumScaled(xs, r)) % 1000003;
    c = (c + wordLengths(xs, r)) % 1000003;
  }
  console.log(`${c}`);
  return 0;
};
