// --deny-panics refuses a value entering a range the checker cannot prove it
// lies in, with the NL9013 guard.
type Digit = integer<0, 9>;

export const digit = (n: i32): i32 => {
  const d: Digit = n;
  return d;
};
