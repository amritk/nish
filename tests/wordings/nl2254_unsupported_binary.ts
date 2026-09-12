// NL2254: A binary operator with no checker names itself, which is how `**` is refused.
export const main = (): i32 => {
  const x: i32 = 2 ** 3;
  return x;
};
