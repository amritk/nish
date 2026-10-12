import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const cap: i32[] = [5, 3, 1, 4, 2];
  const src: i32[] = [9, 9, 9, 9, 9];
  const ys = parallelFrom(3000000, (i): i32 => {
    cap.set(src);
    return cap[0] + i;
  });
  console.log(`${cap[0]} ${ys.length}`);
  return 0;
};
