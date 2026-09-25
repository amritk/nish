// NL2343: a block-bodied arrow whose result type is left to it, with no
// annotation to take it from.
const make = <U>(f: (x: i32) => U): i32 => 0;

export const main = (): i32 =>
  make((x) => {
    return x * 2;
  });
