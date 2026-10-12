// The bounds proof does not assume a chain ran to its end. `h?.pick(xs[i])`
// reads `xs[i]` only where `h` is not `null`, so the later `xs[i]` keeps its
// check: the golden holds two calls of `nish_panic_index`, and without the
// rule the second read went unchecked and read past the array when `h` was
// `null`. `sum` is exported, so no caller's index is known and neither read
// is proved by the call sites.
class Holder {
  scale: i32 = 2;
  pick(x: i32): i32 {
    return x * this.scale;
  }
}

export const sum = (h: Holder | null, xs: i32[], i: i32): i32 => {
  const first = h?.pick(xs[i]) ?? 0;
  return first + xs[i];
};

export const main = (): i32 => {
  const xs = [1, 2, 3];
  console.log(`${sum(new Holder(), xs, 1)} ${sum(null, xs, 2)}`);
  return 0;
};
