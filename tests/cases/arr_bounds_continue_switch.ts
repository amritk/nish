// #181 through a `switch`: a `continue` in a clause leaves the `switch` and
// reaches the `for` update, which writes `xs[i]` after the clause rebound `xs`
// and moved `i`. The guard after the `switch` proves `i < xs.length` on the
// path that falls through, so only the `continue` edge can take the proof
// away. (A `break` in a clause leaves only the `switch`.) Run by tests/run.js:
// exit 1 with "index out of range: 7 >= 1" on stderr.
export const main = (): number => {
  let xs: i32[] = [10, 20, 30, 40, 50, 60, 70, 80];
  let n = 0;
  let i = 0;
  for (i = 0; i >= 0 && i < xs.length; xs[i] = 1000000) {
    n = n + 1;
    switch (n) {
      case 1: {
        xs = [1];
        i = 7;
        continue;
      }
      default: {
        break;
      }
    }
    if (i < 0 || i >= xs.length) {
      break;
    }
    if (n > 3) {
      break;
    }
  }
  console.log(`n=${n} i=${i}`);
  return 0;
};
