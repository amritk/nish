// A statement after a labelled block that returns on every path is
// unreachable, and the diagnostic names the block rather than a loop.
const pick = (n: i32): i32 => {
  found: {
    if (n > 0) {
      return 1;
    }
    return 0;
  }
  return -1;
};

export const main = (): void => {
  console.log(pick(1));
};
