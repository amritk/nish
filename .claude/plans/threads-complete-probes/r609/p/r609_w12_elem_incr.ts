import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const cap: i32[] = [0, 0, 0];
  const ys = parallelFrom(3000000, (i): i32 => {
    cap.fill(i);
    return cap[1] - i;
  });
  let s: f64 = 0.0;
  for (const y of ys) s = s + toF64(y);
  console.log(`${cap[0]} ${s}`);
  return 0;
};
