// NL7001: `Arena.release` and `Arena.reset` still compile, to the calls they
// always did, and warn: each points to `using a = arena()`, the same release
// with the escape check done by the compiler.
export const main = (): i32 => {
  const m = Arena.mark();
  Arena.release(m);
  return 0;
};
