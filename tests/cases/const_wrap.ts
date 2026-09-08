// Compiled with `--wrapping` (see .args). Constant arithmetic wraps at the
// declared width, exactly as the `add` it replaces would, so folding never
// changes what the program computes. Without the flag the same initialiser is
// a compile error, because the `add` would be undefined behaviour — that is
// `tests/cases/reject_const_overflow_arith`.
const MAX: i32 = 2147483647;
const WRAPPED: i32 = MAX + 1;

export function test(): number {
  return WRAPPED;
}
