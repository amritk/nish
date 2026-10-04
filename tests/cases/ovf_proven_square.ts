// `i * i <= n` bounds `i` by the square root of `n`'s bound: with `n` below
// 1001 (every caller passes 1000) `i` is at most 31, so `i++`, `j = i * i` and
// `j += i` all fit, which is a sieve's inner loop without an overflow check
// (src/bounds.ts, "Signed overflow"). The condition's own `i * i` is checked:
// at the top of a pass `i` has just been stepped.
const marks = (composite: boolean[], n: i32): i32 => {
  let marked: i32 = 0;
  for (let i: i32 = 2; i * i <= n; i++) {
    for (let j: i32 = i * i; j <= n; j += i) {
      if (j >= 0 && j < composite.length && !composite[j]) {
        composite[j] = true;
        marked = marked ^ j;
      }
    }
  }
  return marked;
};

export const test = (): number => marks(new Array<boolean>(1001), 1000);
