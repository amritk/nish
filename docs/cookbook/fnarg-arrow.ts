// An arrow argument is lifted into a function of its own, and `U` is bound
// from its body: `map<i32, f64, (n) => ...>`.
const map = <T, U>(xs: T[], f: (x: T) => U): U[] => {
  const out: U[] = [];
  for (const x of xs) {
    out.push(f(x));
  }
  return out;
};

export const halves = (xs: i32[]): f64[] => map(xs, (n) => toF64(n) / 2.0);
