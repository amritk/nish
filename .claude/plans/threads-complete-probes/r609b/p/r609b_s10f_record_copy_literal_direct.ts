interface P { v: i32; }
export const main = (): i32 => {
  const p: P = { v: 1 };
  const ps: P[] = [p];
  ps[0].v = 5;
  console.log(`${p.v * 10 + ps[0].v}`);
  return 0;
};
