// A proven step is a plain `add nsw`, with no overflow check (src/bounds.ts,
// "Signed overflow"). `i < n` for any `i32` `n` leaves `i` at most
// `INT_MAX - 1`, so `i++` fits; `i < xs.length` does the same for `i + 1`.
// `s` is unbounded and keeps its check, which is what the proven ones are
// compared against.
export const sumTo = (n: i32): i32 => {
  let s: i32 = 0;
  for (let i: i32 = 0; i < n; i++) {
    s = s + i;
  }
  return s;
};

export const pairs = (xs: i32[]): i32 => {
  let count: i32 = 0;
  for (let i = 0; i < xs.length; i++) {
    const next: i32 = i + 1;
    if (next < xs.length && xs[i] === xs[next]) {
      count = count + 1;
    }
  }
  return count;
};

export const test = (): number => sumTo(10) + pairs([1, 1, 2, 2, 2]);
