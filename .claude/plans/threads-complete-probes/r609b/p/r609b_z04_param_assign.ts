const f = (t: i32[], d: i32[]): i32 => {
  t = d;
  return t[0];
};
export const main = (): i32 => { const a: i32[] = [1]; const b: i32[] = [2]; console.log(`${f(a, b)}`); return 0; };
