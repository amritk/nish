// The `break` counterpart of #181 in a `while`, on a local. The condition
// rebinds `xs` to six elements, the body rebinds it to one and leaves by
// `break`, so `xs[5]` after the loop is not proven by the condition. Run by
// tests/run.js: exit 1 with "index out of range: 5 >= 1" on stderr.
export const main = (): number => {
  let xs: i32[] = [1];
  while ((xs = [1, 2, 3, 4, 5, 6]).length > 0) {
    xs = [1];
    break;
  }
  console.log(`${xs[5]}`);
  return 0;
};
