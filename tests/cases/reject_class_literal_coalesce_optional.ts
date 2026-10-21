// NL2556: The fallback of `??` after a `?.` chain takes the last link's class, `Counter`, as its contextual type. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
class Holder {
  c: Counter;
  constructor() {
    this.c = new Counter(1);
  }
}
export const main = (): i32 => {
  const h: Holder | null = null;
  const d = h?.c ?? { n: 5 };
  return d.get();
};
