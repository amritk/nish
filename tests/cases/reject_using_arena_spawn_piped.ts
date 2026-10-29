// `spawnPiped` appends to its `stdout` and `stderr` with `nish_array_grow`, as
// `push` grows its receiver, so a `using a = arena()` block may not hand it an
// array older than the block: the growth would land in the block's arena and
// be released under the array when the block ends.
export const main = (): i32 => {
  const out: u8[] = [];
  const err: u8[] = [];
  {
    using a = arena();
    const none: u8[] = [];
    spawnPiped(["true"], none, out, err);
  }
  console.log(out.length);
  return 0;
};
