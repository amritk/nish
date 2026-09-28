// A `for...of` head that assigns an existing variable, in a generic function
// nothing instantiates: refused all the same (NL2135), by the pass 1 sweep
// that sees bodies no instantiation ever checks.
const last = <T>(xs: T[], seed: T): T => {
  let x: T = seed;
  for (x of xs) {
    seed = x;
  }
  return seed;
};

export const main = (): i32 => 0;
