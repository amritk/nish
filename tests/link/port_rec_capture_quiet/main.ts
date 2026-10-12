// WP33 NL8003, the quiet side of a capture (WP29): the arrow reads `p` where
// `parallelFrom` runs it, before the write through the array, and nothing
// reads `p` after that write, so nothing here differs from TypeScript.
import { parallelFrom } from "nish/threads";

interface P {
  v: i32;
}

export const main = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  const ys = parallelFrom(2, (i) => p.v + i);
  ps[0].v = 5;
  console.log(`${ys[1]} ${ps[0].v}`);
  return 0;
};
