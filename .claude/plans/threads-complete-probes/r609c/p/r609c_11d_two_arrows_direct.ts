interface P { v: i32; }
export const main = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  ps[0].v = 5;
  const y = p.v;
  const z = p.v * 2;
  console.log(`${y} ${z}`);
  return 0;
};
