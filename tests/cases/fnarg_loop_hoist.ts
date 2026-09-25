// WP29: an arrow written inside a loop is lifted out of it, so the loop's
// array-header hoisting must not see the arrow's parameter `r` — it is no
// local of `main`, and a preheader load of it named a value that does not
// exist there. The arrow's own body hoists and proves on its own.
const sumBy = <T>(xs: T[], f: (x: T) => i32): i32 => {
  let s = 0;
  for (const x of xs) {
    s = s + f(x);
  }
  return s;
};

export const main = (): i32 => {
  const rows: i32[][] = [[1, 2], [3]];
  let t = 0;
  for (let i = 0; i < 3; i++) {
    t = t + sumBy(rows, (r: i32[]) => r.length + r[0]);
  }
  console.log(`${t}`);
  return 0;
};
