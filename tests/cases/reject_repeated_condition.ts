// The second `n > 10` can never be reached: the first branch took every n it
// would have matched. The second test was meant to be `n > 100` (NL2716).
const size = (n: i32): string => {
  if (n > 10) {
    return "big";
  } else if (n > 10) {
    return "huge";
  }
  return "small";
};

export const main = (): i32 => {
  console.log(size(500));
  return 0;
};
