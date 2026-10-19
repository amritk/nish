// A map run 3,000 times in a loop, each run on 16 elements, and each element a
// short string or a two-element array. The bodies' loops are written to 40,000
// and leave at 400, so the grain is 1 and every run divides as far as the
// machine has threads while the test stays fast.
// What the chunks keep is a few hundred bytes a run, so the join copies it
// into the caller's arena and frees the blocks (`nish_cross_adopt`). Before
// that, each chunk took a 64 KB transfer block however little it kept, and
// the caller adopted them all, leaving its current chunk behind each time:
// the loop peaked at 125 MB on four threads and 53 MB on one; it now peaks at
// 5 MB on either.
import { parallelFrom, parallelMap } from "nish/threads";

const word = (x: i32): string => {
  let h = x;
  for (let k = 0; k < 40000; k++) {
    if (k >= 400) {
      break;
    }
    h = (h * 31 + k) % 1000003;
  }
  return `w${h % 97}`;
};

const pair = (i: i32): i32[] => {
  let h = i;
  for (let k = 0; k < 40000; k++) {
    if (k >= 400) {
      break;
    }
    h = (h * 17 + k) % 1000003;
  }
  return [i, h % 89];
};

export const main = (): i32 => {
  const xs: i32[] = [];
  for (let i = 0; i < 16; i++) {
    xs.push(i);
  }
  let total = 0;
  let last = "";
  let sum = 0;
  for (let it = 0; it < 3000; it++) {
    const r = parallelMap(xs, word);
    total = total + r[0].length + r[15].length;
    last = r[7];
    const rows = parallelFrom(16, pair);
    sum = sum + rows[3][1] + rows[15][0];
  }
  console.log(`${total} ${last} ${sum}`);
  return 0;
};
