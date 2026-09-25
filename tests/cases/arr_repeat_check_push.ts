// `push` and `pop` move `len`, so a passed check on the array before one of
// them proves nothing after it: both repeats keep their check.
const afterPop = (xs: i32[], i: i32): i32 => {
  const a = xs[i];
  xs.pop();
  return a + xs[i];
};

const afterPush = (xs: i32[], i: i32): i32 => {
  const a = xs[i];
  xs.push(a);
  return a + xs[i];
};

export const test = (): number => afterPop([1, 2, 3], 1) + afterPush([1, 2, 3], 2);
