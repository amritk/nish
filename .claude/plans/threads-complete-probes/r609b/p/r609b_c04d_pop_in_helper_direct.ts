interface P { v: i32; }
const churn = (ps: P[]): void => { ps.pop(); ps.push({ v: 77 }); };
const f = (): i32 => {
  const ps: P[] = [{ v: 1 }, { v: 2 }];
  const last = ps[1];
  churn(ps);
  return last.v;
};
export const main = (): i32 => { console.log(`${f()}`); return 0; };
