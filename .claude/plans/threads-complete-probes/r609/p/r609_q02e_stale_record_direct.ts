interface P {
  v: i32;
}
const f = (xs: i32[]): i32 => {
  const ps: P[] = [{ v: 1 }];
  const first = ps[0];
  ps.push({ v: 2 });
  ps[0].v = 9;
  return first.v + xs[0];
};
export const main = (): i32 => { console.log(`${f([1, 2])}`); return 0; };
