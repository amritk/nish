interface P { v: i32; }
const setFirst = (xs: P[]): void => {
  xs[0].v = 5;
};
export const main = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  setFirst(ps);
  console.log(`${p.v}`);
  return 0;
};
