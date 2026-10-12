interface P { v: i32; }
const f = (): i32 => {
  const ps: P[] = [{ v: 1 }, { v: 2 }];
  const last = ps[1];
  ps.length = 1;
  ps.push({ v: 50 });
  return last.v;
};
export const main = (): i32 => { console.log(`${f()}`); return 0; };
