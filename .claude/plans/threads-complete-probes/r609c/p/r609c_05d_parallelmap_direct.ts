interface P { v: i32; }
export const main = (): i32 => {
  const src: i32[] = [10, 20, 30];
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  ps[0].v = 5;
  const ys: i32[] = [];
  for (const x of src) ys.push(x + p.v);
  console.log(`${ys[0]} ${ys[2]}`);
  return 0;
};
