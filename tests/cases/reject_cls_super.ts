// With no base class there is nothing for `super` to name, in any of its
// three spellings (`super(...)`, `super.m()`, a bare `super`).
class Counter {
  n: number;

  constructor(n: number) {
    super(n);
    this.n = n;
  }
}

export function test(): number {
  return new Counter(1).n;
}
