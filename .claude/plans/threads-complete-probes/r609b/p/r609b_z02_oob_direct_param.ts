const run = (n: i32): i32 => {
  const tab = new Int32Array(n);
  tab.fill(3);
  for (let i: i32 = 0; i < n; i++) tab[i] = i;
  let last: i32 = 0;
  for (let i: i32 = 0; i < n + 3; i++) last = tab[i];
  return last;
};
export const main = (): i32 => {
  console.log(`${run(10)}`);
  return 0;
};
