interface P { v: i32; }
export const main = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  const qs = ps;
  p.v = 5;
  console.log(`${qs[0].v}`);
  return 0;
};
