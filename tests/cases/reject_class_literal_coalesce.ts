// NL2556: The fallback of `??` takes the left side's class, `Counter`, as its contextual type. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
export const main = (): i32 => {
  const c: Counter | null = null;
  const d = c ?? { n: 5 };
  return d.get();
};
