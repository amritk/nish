interface P { v: i32; }
export const main = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  const q = p;
  ps[0].v = 5;
  console.log(`${q.v}`);
  return 0;
};
