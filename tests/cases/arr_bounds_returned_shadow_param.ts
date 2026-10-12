// A size named in the helper is read as a parameter only when the body
// declares nothing of that name: here an inner `n` of 1 shadows the parameter,
// so `inner(8)` gives no length. The read keeps its check, and panics.
const inner = (n: i32, narrow: boolean): i32[] => {
  if (narrow) {
    const n = 1;
    return new Array<i32>(n);
  }
  return new Array<i32>(n);
};

export const main = (): number => {
  const xs = inner(8, true);
  console.log(`${xs[7]}`);
  return 0;
};
