// #181 for `do/while` on a local: `arr_path_continue_do` with the array in a
// local. The second pass rebinds `xs` to a one-element array before
// `continue`, and the condition reads `xs[3]`. Run by tests/run.js: exit 1
// with "index out of range: 3 >= 1" on stderr.
export const main = (): number => {
  let xs: i32[] = [1, 2, 3, 4];
  let n = 0;
  let i = 0;
  do {
    n = n + 1;
    if (n === 1) {
      i = 3;
    }
    if (i < 0 || i >= xs.length) {
      break;
    }
    if (n === 2) {
      xs = [5];
      continue;
    }
  } while (xs[i] > 0 && n < 5);
  console.log(`n=${n}`);
  return 0;
};
