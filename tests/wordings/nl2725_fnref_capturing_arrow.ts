// NL2725: an arrow in a value position that reads a local of the function
// around it. A reference is a tag, so it has nowhere to keep `n`.
export const main = (): i32 => {
  const n = 3;
  const f = (x: i32): i32 => x + n;
  return f(1);
};
