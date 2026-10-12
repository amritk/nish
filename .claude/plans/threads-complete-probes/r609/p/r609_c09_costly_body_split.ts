import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const tab: i32[] = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const salt: i32 = 11;
  const ys = parallelFrom(20000, (i): i32 => {
    let h: i32 = i;
    for (let r: i32 = 0; r < 500; r++) {
      h = (h * 31 + tab[(h + r) % 10] + salt) % 1000003;
    }
    return h;
  });
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000003;
  console.log(`${s} ${ys[0]} ${ys[19999]}`);
  return 0;
};
