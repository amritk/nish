import { parallelMapInto } from "nish/threads";
export const main = (): i32 => {
  const weights: f64[] = [0.1, 0.2, 0.3];
  const src: f64[] = [10.0, 20.0, 30.0];
  const dst: f64[] = [0.0, 0.0, 0.0];
  const scale: f64 = 2.0;
  parallelMapInto(src, dst, (x) => x * scale + weights[0]);
  console.log(`${dst[0]} ${dst[1]} ${dst[2]}`);
  return 0;
};
