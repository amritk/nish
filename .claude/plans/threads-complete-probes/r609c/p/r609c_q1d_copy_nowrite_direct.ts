interface P { v: i32; }
export const main = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  console.log(`${p.v + ps[0].v + 1}`);
  return 0;
};
