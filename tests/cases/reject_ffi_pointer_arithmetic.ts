// No arithmetic: a `CPtr` is an address, not a number, and the compiler has no
// idea what it points at or how much of it there is. The refusal is the
// ordinary operand rule, which already says the right thing.
declare function handle(): CPtr;

export const main = (): i32 => {
  const open = handle();
  return open + 1;
};
