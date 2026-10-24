// An f64 compound store whose right side shrinks the array: JavaScript's `+=`
// already answers the f64 sum, but the store is still checked again after
// the right side ran, at a proven index and at an unproven one.
const shrink = (xs: f64[]): f64 => {
  xs.pop();
  return 0.5;
};

const bump = (xs: f64[], k: i32): void => {
  xs[k] += shrink(xs);
};

export const main = (): i32 => {
  const xs: f64[] = [1.5, 2.5];
  const ks: i32[] = [1];
  if (xs.length > 1) {
    xs[0] += 0.25;
  }
  console.log(`${xs[0]} ${xs.length}`);
  bump(xs, ks[0]);
  console.log("unreachable");
  return 0;
};
