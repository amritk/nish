import { parallelFrom, parallelMap } from "nish/threads";
class P {
  w: i32 = 3;
  f: f64 = 0.5;
}
const run = (n: i32): f64 => {
  const flag: boolean = n > 10;
  const small: u8 = toU8(7);
  const big: i64 = toI64(1000000007);
  const half: f64 = 0.25;
  const s = "abcdefgh";
  const p = new P();
  const tab: i32[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const ys = parallelFrom(n, (i): f64 => {
    let v: f64 = toF64(tab[i % 11]) * half + toF64(s.charCodeAt(i % 8)) + p.f * toF64(p.w);
    if (flag) v = v + toF64(toI32(small));
    v = v + toF64(toI64(i) % big);
    return v;
  });
  const zs = parallelMap(ys, (y) => (flag ? y * half : y) + toF64(toI32(small)));
  let acc: f64 = 0.0;
  for (const z of zs) acc = acc + z;
  return acc;
};
export const main = (): i32 => {
  console.log(`${run(5)} ${run(3000000)} ${run(1)} ${run(0)}`);
  return 0;
};
