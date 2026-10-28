// A constant whose arithmetic leaves its width is refused rather than folded:
// the checked `add` it stands for would panic, so the compiler will not hand
// back a wrapped value in its place.
const MAX: i32 = 2147483647;
const OVER: i32 = MAX + 1;

export function test(): number {
  return OVER;
}
