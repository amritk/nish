// The `break` counterpart of #181, on a local. The `for` condition assigns
// `i = 2` and then proves `i < xs.length`, but the body moves `i` and leaves by
// `break`, so the state after the loop is the join of the condition's exit and
// that `break` rather than the condition alone. Run by tests/run.js: exit 1
// with "index out of range: 1000 >= 3" on stderr.
export const main = (): number => {
  const xs: i32[] = [10, 20, 30];
  let i = 0;
  let n = 0;
  for (; (i = 2) >= 0 && i < xs.length; n = n + 1) {
    i = 1000;
    break;
  }
  console.log(`${xs[i]}`);
  return 0;
};
