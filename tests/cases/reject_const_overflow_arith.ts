// Under the default `nsw`, a constant whose arithmetic leaves its width is
// refused rather than folded: the `add` it stands for would be undefined
// behaviour, so the compiler will not hand back the one value the optimiser is
// entitled to assume cannot happen. `tests/cases/const_wrap` is the same
// expression under `--wrapping`, where it folds to -2147483648.
const MAX: i32 = 2147483647;
const OVER: i32 = MAX + 1;

export function test(): number {
  return OVER;
}
