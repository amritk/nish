// A callee that resets the arena is refused inside a `using a = arena()` block
// for the reason `Arena.reset` itself is: the block's mark would be stale.
const wipe = (): void => {
  Arena.reset();
};

export const main = (): i32 => {
  {
    using a = arena();
    wipe();
  }
  return 0;
};
