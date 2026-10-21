// NL2556: A nullable class target `Counter | null` still names a class with methods. A class with methods is made only by `new`.
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
  const c: Counter | null = { n: 5 };
  if (c !== null) {
    return c.get();
  }
  return 0;
};
