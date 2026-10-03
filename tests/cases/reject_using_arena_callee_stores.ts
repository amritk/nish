// A `using a = arena()` block may not call a function that stores what it
// allocates into memory: `stamp` writes a fresh string into `b`, so the block
// would release memory `b` still points at.
class Box {
  label: string = "";
}

const stamp = (b: Box, n: i32): void => {
  b.label = `stamp ${n}`;
};

export const main = (): i32 => {
  const b = new Box();
  {
    using a = arena();
    stamp(b, 6);
  }
  console.log(b.label);
  return 0;
};
