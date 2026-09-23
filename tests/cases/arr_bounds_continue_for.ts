// #181 on a local: the same `continue` edge as `arr_path_continue_for`, with
// the array in a local rather than a field. The `continue` branch rebinds `xs`
// and moves `i`, and the `for` update writes `xs[i]`, so the update has to be
// judged in a state that covers that edge. Run by tests/run.js: exit 1 with
// "index out of range: 7 >= 1" on stderr.
export const main = (): number => {
  let xs: i32[] = [10, 20, 30, 40, 50, 60, 70, 80];
  let n = 0;
  let i = 0;
  for (i = 0; i >= 0 && i < xs.length; xs[i] = 1000000) {
    n = n + 1;
    if (n === 1) {
      xs = [1];
      i = 7;
      continue;
    }
    if (n > 3) {
      break;
    }
  }
  console.log(`n=${n} i=${i}`);
  return 0;
};
