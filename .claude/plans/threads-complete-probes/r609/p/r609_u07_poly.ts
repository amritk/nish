import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const coeff: f64[] = [1.0, -2.0, 0.5];
  const xs: f64[] = [0.0, 1.0, 2.0, 4.0];
  const ys = parallelMap(xs, (x): f64 => {
    let acc: f64 = 0.0;
    for (let i: i32 = coeff.length - 1; i >= 0; i--) acc = acc * x + coeff[i];
    return acc;
  });
  console.log(`${ys[0]} ${ys[1]} ${ys[2]} ${ys[3]}`);
  return 0;
};
