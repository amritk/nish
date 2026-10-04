// NL7002: the loop proves `xs[i]`, but the compound store checks its index
// again after a right side that calls, and the flag drops that check.
const weight = (i: i32): i32 => i * 2;

export const scale = (xs: i32[]): void => {
  for (let i = 0; i < xs.length; i++) {
    xs[i] += weight(i);
  }
};
