// A `switch` is a `break` target, not a loop, so `continue` has nothing to continue.
export const run = (n: i32): number => {
  switch (n) {
    case 1:
      continue;
    default:
      return 0;
  }
};
