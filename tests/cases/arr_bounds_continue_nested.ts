// #181 across two loops. The outer body's `continue` rebinds `xs` and moves
// `i`; an inner loop with a `continue` of its own follows it. The inner loop
// opens its own frame, so its `continue` goes to the inner update and the outer
// one's state is still there when the outer update, which writes `xs[i]`, is
// judged. Run by tests/run.js: exit 1 with "index out of range: 7 >= 1" on
// stderr.
export const main = (): number => {
  let xs: i32[] = [10, 20, 30, 40, 50, 60, 70, 80];
  let n = 0;
  let m = 0;
  let i = 0;
  let j = 0;
  for (i = 0; i >= 0 && i < xs.length; xs[i] = 1000000) {
    n = n + 1;
    if (n === 1) {
      xs = [1];
      i = 7;
      continue;
    }
    for (j = 0; j < 3; j = j + 1) {
      if (j === 1) {
        continue;
      }
      m = m + 1;
    }
    if (n > 3) {
      break;
    }
  }
  console.log(`n=${n} m=${m} i=${i}`);
  return 0;
};
