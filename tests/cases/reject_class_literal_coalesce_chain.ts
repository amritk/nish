// NL2556: The last fallback of a `??` chain still takes the class `Counter` as its contextual type. A class with methods is made only by `new`.
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
  const a: Counter | null = null;
  const b: Counter | null = null;
  const d = a ?? b ?? { n: 5 };
  return d.get();
};
