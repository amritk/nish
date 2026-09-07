// Constant arithmetic wraps at the declared width, exactly as the `add` it
// replaces would, so folding never changes what the program computes.
const MAX: i32 = 2147483647;
const WRAPPED: i32 = MAX + 1;

function test(): number {
  return WRAPPED;
}
