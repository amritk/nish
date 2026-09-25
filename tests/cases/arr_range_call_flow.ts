// #209's dominance rules, pinned where call-site ranges cannot reach them.
// `arr_repeat_check_flow` calls each function with a literal index its caller
// proves, so since WP15 §2.4 every access there is proven on entry and none
// of its repeats is judged by the rule it was written for. Here every function
// is exported, and so entered knowing nothing: a check inside one arm of an
// `if`, on the right of `&&`, in one arm of `?:`, or in a loop body that may
// run no times does not prove the repeat after it, and each keeps its check. A
// check in a condition runs on both arms, so `inCondition` proves its body.
export const inBranch = (xs: i32[], i: i32, c: boolean): i32 => {
  let a = 0;
  if (c) {
    a = xs[i];
  }
  return a + xs[i];
};

export const shortCircuit = (xs: i32[], i: i32, c: boolean): i32 => {
  let a = 0;
  if (c && xs[i] > 0) {
    a = 1;
  }
  return a + xs[i];
};

export const ternary = (xs: i32[], i: i32, c: boolean): i32 => {
  const a = c ? xs[i] : 0;
  return a + xs[i];
};

export const inLoop = (xs: i32[], i: i32, n: i32): i32 => {
  let total = 0;
  for (let k = 0; k < n; k = k + 1) {
    total = total + xs[i];
  }
  return total + xs[i];
};

export const backEdge = (xs: i32[]): i32 => {
  let total = 0;
  let k = 0;
  while (total < 5) {
    total = total + xs[k];
    k = k + 1;
  }
  return total;
};

export const inCondition = (xs: i32[], i: i32): i32 => {
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
