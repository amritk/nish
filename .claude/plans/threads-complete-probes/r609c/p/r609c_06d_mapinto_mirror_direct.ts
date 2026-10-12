interface P { v: i32; }
export const main = (): i32 => {
  const src: i32[] = [10, 20, 30];
  const dst: i32[] = [0, 0, 0];
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  p.v = 5;
  for (let i: i32 = 0; i < src.length; i++) dst[i] = src[i] + ps[0].v;
  console.log(`${dst[0]} ${dst[2]}`);
  return 0;
};
