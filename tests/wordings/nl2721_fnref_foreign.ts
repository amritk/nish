// NL2721: a `declare function` named as a value: its body is C's.
declare function abs(x: i32): i32;

export const main = (): i32 => {
  const f = abs;
  return 0;
};
