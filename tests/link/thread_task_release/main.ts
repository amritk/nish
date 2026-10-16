// Each task bumps some 60 KB of temporaries and answers a short string, and
// the scope spawns 8,000 of them. A task's temporaries are released where it
// ran once its answer is copied out: a worker's arena is also reset by the
// pool, but the caller's, which runs every task under `NISH_NUM_THREADS=1`
// and drains the rest otherwise, is not. Without that release the caller kept
// every task's temporaries, and one thread peaked at 1.87 GB rather than 11 MB.
import { scope } from "nish/threads";

const work = (n: i32): string => {
  const parts: string[] = [];
  for (let i = 0; i < 2000; i++) {
    parts.push(`${n}-${i}-padding`);
  }
  return `${n}:${parts.length}`;
};

export const main = (): i32 => {
  const out: string[] = [];
  for (let i = 0; i < 8000; i++) {
    out.push("");
  }
  {
    using s = scope();
    for (let i = 0; i < out.length; i++) {
      s.spawn(work, i, out, i);
    }
  }
  let t = 0;
  for (let i = 0; i < out.length; i++) {
    t = t + out[i].length;
  }
  console.log(`${t} ${out[7999]}`);
  return 0;
};
