// NL2336: an arrow anywhere but as a function argument, here returned.
const make = (n: i32): i32 => {
  return (x: i32): i32 => x + n;
};

export const main = (): i32 => make(1);
