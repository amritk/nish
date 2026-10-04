// The negative of `bounds_panic_guard` for a shadowed name: `panic` here is a
// function parameter, so `panic(3)` calls whatever function `pick` was given,
// which returns, and the check on `xs[i]` stays. Out of range, the access
// panics with the index error rather than reading past the array.
const ignore = (code: number): void => {
  console.log(`ignored ${code}`);
};

const pick = (panic: (code: number) => void, xs: number[], i: number): number => {
  if (i < 0 || i >= xs.length) {
    panic(3);
  }
  return xs[i];
};

export const test = (): number => pick(ignore, [10, 20, 30], 2);
