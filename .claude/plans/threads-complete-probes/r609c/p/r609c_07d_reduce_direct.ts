interface P { v: i32; }
export const main = (): i32 => {
  const src: i32[] = [0, 2, 3, 1];
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  ps[0].v = 5;
  let m: i32 = 0;
  for (const x of src) {
    const b = m > x ? m : x;
    m = b > p.v ? b : p.v;
  }
  console.log(`${m}`);
  return 0;
};
