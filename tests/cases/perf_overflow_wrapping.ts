// WP15 §8: `--wrapping` says the program wants two's-complement wrapping, so
// the constant-overflow warning has nothing to argue with and stays quiet.
// The value is defined under that flag, which is why this one can run.
export function test(): number {
  const wrapped = 2147483647 + 1;
  return wrapped;
}
