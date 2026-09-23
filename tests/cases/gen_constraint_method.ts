// WP18 G6: a class constraint lends its methods too. `c.bump()` through a
// `T extends Counter` is a direct `call @Counter.bump` in `twice$$Counter`,
// with no indirection, because `T` at `Counter` is `Counter` (WP18 §6.5).
class Counter {
  count: i32;

  constructor(start: i32) {
    this.count = start;
  }

  bump(): i32 {
    this.count = this.count + 1;
    return this.count;
  }
}

const twice = <T extends Counter>(c: T): i32 => {
  c.bump();
  return c.bump();
};

export const test = (): number => twice(new Counter(40));
