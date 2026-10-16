// Each element's body builds a string of some 2 KB and answers a 4-byte one
// cut from it. The chunk loop keeps the answer and gives back what the body
// bumped to make it (`nish_cross_keep`), so a chunk holds one element's
// temporaries at a time. Before that, a chunk held every element's until the
// chunk itself was released: a million elements peaked at 2.1 GB rather than
// 64 MB, on one thread or eight.
import { parallelFrom, parallelMap } from "nish/threads";

export const main = (): i32 => {
  const parts: string[] = [];
  for (let i = 0; i < 1000; i++) {
    parts.push("b");
  }
  const big = parts.join("");
  const xs: i32[] = [];
  for (let i = 0; i < 1000000; i++) {
    xs.push(i);
  }
  const r = parallelMap(xs, (x): string => {
    const t = [big, `${x}`, big].join("|");
    let h = 0;
    for (let k = t.length - 1; k >= 0; k -= 97) {
      h = (h + t.charCodeAt(k)) % 1000;
    }
    return `${((h + x) % 9000) + 1000}`.slice(0, 4);
  });
  // An array of scalars per element, kept the same way.
  const rows = parallelFrom(1000, (i): i32[] => {
    const t = [big, `${i}`].join("|");
    return [i, t.length];
  });
  let t = 0;
  for (let i = 0; i < r.length; i++) {
    t = t + r[i].length;
  }
  console.log(`${t} ${r[0]} ${r[999999]} ${rows[999][0]} ${rows[999][1]}`);
  return 0;
};
