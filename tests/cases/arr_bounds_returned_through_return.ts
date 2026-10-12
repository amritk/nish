// A parameter that is returned gives the caller a second name for the array,
// and the helper pops through it: a callee that returns its array keeps no
// length. The read keeps its check, and panics.
const same = (xs: i32[]): i32[] => {
  xs[0] = 1;
  return xs;
};

const aliased = (): i32[] => {
  const arr = new Array<i32>(4);
  const other = same(arr);
  other.pop();
  return arr;
};

export const main = (): number => {
  const xs = aliased();
  console.log(`${xs[3]}`);
  return 0;
};
