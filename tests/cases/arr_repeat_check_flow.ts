// A check proves the repeat only where it dominates it. A check inside one
// arm of an `if`, on the right of `&&`, in one arm of `?:`, or in a loop body
// that may run no times does not; each of those repeats keeps its check. A
// check in a condition runs on both arms, so `inCondition` proves its body.
const inBranch = (xs: i32[], i: i32, c: boolean): i32 => {
  let a = 0;
  if (c) {
    a = xs[i];
  }
  return a + xs[i];
};

const shortCircuit = (xs: i32[], i: i32, c: boolean): i32 => {
  let a = 0;
  if (c && xs[i] > 0) {
    a = 1;
  }
  return a + xs[i];
};

const ternary = (xs: i32[], i: i32, c: boolean): i32 => {
  const a = c ? xs[i] : 0;
  return a + xs[i];
};

const inLoop = (xs: i32[], i: i32, n: i32): i32 => {
  let total = 0;
  for (let k = 0; k < n; k = k + 1) {
    total = total + xs[i];
  }
  return total + xs[i];
};

const backEdge = (xs: i32[]): i32 => {
  let total = 0;
  let k = 0;
  while (total < 5) {
    total = total + xs[k];
    k = k + 1;
  }
  return total;
};

const inCondition = (xs: i32[], i: i32): i32 => {
  if (xs[i] > 0) {
    return xs[i];
  }
  return xs[i] + 1;
};

export const test = (): number => {
  const xs = [1, 2, 3];
  return (
    inBranch(xs, 1, false) +
    shortCircuit(xs, 1, false) +
    ternary(xs, 1, false) +
    inLoop(xs, 1, 0) +
    backEdge(xs) +
    inCondition(xs, 2)
  );
};
