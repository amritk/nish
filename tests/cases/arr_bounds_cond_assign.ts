// The local form with no call: the second operand rebinds the array the first
// one measured. Run by tests/run.js: exit 1 with
// "index out of range: 2 >= 1".
const read = (start: i32[], short: i32[], i: i32): i32 => {
  let xs = start;
  if (i >= 0 && i < xs.length && (xs = short).length > 0) {
    return xs[i];
  }
  return -1;
};

export const main = (): number => {
  console.log(`${read([1, 2, 3], [7], 2)}`);
  return 0;
};
