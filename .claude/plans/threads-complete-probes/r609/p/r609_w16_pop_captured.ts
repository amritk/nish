import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const cap: i32[] = [1, 2, 3];
  const ys = parallelFrom(3000000, (i): i32 => {
    const v = cap.pop();
    return v + i;
  });
  console.log(`${cap.length} ${ys.length}`);
  return 0;
};
