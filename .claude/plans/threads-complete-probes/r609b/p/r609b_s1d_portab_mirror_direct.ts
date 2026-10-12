interface P { v: i32; }
export const main = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  p.v = 5;
  console.log(`${ps[0].v}`);
  return 0;
};
