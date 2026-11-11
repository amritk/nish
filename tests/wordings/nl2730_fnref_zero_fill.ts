// NL2730: an array of references zero-filled by its constructor. The tags
// start at 1, so 0 names no function.
export const main = (): i32 => {
  const fs = new Array<(x: i32) => i32>(4);
  return fs.length;
};
