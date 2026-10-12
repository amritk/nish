const run = (n: i32): i32 => {
  const a = new Array<i32>(n);
  const b = new Array<i32>(n - 2);
  b.fill(4);
  let last: i32 = 0;
  for (let i: i32 = 0; i < a.length; i++) last = b[i];
  return last;
};
export const main = (): i32 => { console.log(`${run(10)}`); return 0; };
