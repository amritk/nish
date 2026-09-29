// A `continue` that names a label is part of the labelled statement's one
// refusal (NL1046), as a `break` that names one is.
export const main = (): i32 => {
  let n: i32 = 0;
  outer: while (n < 3) {
    n = n + 1;
    continue outer;
  }
  return n;
};
