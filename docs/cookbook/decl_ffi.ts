declare function abs(n: i32): i32;

const pureDouble = (n: i32): i32 => {
  return n * 2;
};

export const main = (): i32 => {
  return abs(-7) + pureDouble(3);
};
