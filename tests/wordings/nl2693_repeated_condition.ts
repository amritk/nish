// NL2693: an `else if` that repeats an earlier condition can never run.
const size = (n: i32): i32 => {
  if (n > 10) {
    return 2;
  } else if (n > 10) {
    return 3;
  }
  return 1;
};

export const main = (): i32 => size(5) - 1;
