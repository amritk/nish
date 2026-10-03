// `Arena.release` inside a `using a = arena()` block moves the arena below the
// mark the block took, so the block's own release would name a stale mark.
export const main = (): i32 => {
  const m = Arena.mark();
  {
    using a = arena();
    Arena.release(m);
  }
  return 0;
};
