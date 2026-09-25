// WP29 with WP18: the value arguments bind what they can first, then the
// function argument binds the rest. `map`'s `U` comes from the arrow's body,
// `firstWhere`'s `T` only from the named callee's parameter, and `fold`'s
// literal identity takes the element type its array bound: an `f64` zero,
// though this is i32 number mode.
const map = <T, U>(xs: T[], f: (x: T) => U): U[] => {
  const out: U[] = [];
  for (const x of xs) {
    out.push(f(x));
  }
  return out;
};

const fold = <T>(xs: T[], f: (acc: T, x: T) => T, identity: T): T => {
  let acc = identity;
  for (const x of xs) {
    acc = f(acc, x);
  }
  return acc;
};

const countWhere = <T>(pred: (x: T) => boolean, xs: T[]): i32 => {
  let n = 0;
  for (const x of xs) {
    if (pred(x)) {
      n = n + 1;
    }
  }
  return n;
};

const isLong = (s: string): boolean => s.length > 3;

export const main = (): i32 => {
  const labels = map([1, 2, 3], (n) => `#${n}`);
  const xs: f64[] = [1.0, 3.0];
  const halves = map(xs, (x: f64): f64 => x / 2.0);
  const sum = fold(halves, (a, b) => a + b, 0.0);
  console.log(`${labels[2]} ${sum} ${countWhere(isLong, ["ab", "abcd", "abcde"])}`);
  return 0;
};
