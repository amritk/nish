// `spawnPipedWithin` appends to its `stdout` and `stderr` as `spawnPiped`
// does, with `nish_array_grow`, so a `using a = arena()` block may not hand it
// an array older than the block either.
export const main = (): i32 => {
  const out: u8[] = [];
  const err: u8[] = [];
  {
    using a = arena();
    const none: u8[] = [];
    spawnPipedWithin(["true"], none, out, err, 1000);
  }
  console.log(out.length);
  return 0;
};
