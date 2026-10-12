import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const src: i32[] = [1, 2, 3];
  const ys = parallelMap(src, (x) => x);
  ys[0] = 100;
  ys.push(7);
  const big = new Int32Array(3000000);
  big.fill(5);
  const zs = parallelMap(big, (x) => x);
  zs[0] = 99;
  console.log(`${src[0]} ${src.length} ${ys[0]} ${ys.length} ${big[0]} ${zs[0]} ${zs[1]}`);
  return 0;
};
