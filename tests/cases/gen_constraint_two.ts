// WP18 G6: each type parameter answers from its own constraint. `s.area` is
// `Shape`'s, `c.bump()` is `Counter`'s, and neither parameter lends the other
// a member — the lookup is by the parameter's position in `<T, U>`.
interface Shape {
  area: i32;
}

class Circle implements Shape {
  area: i32;

  constructor(area: i32) {
    this.area = area;
  }
}

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

const combine = <T extends Shape, U extends Counter>(s: T, c: U): i32 => s.area + c.bump();

export const test = (): number => combine(new Circle(12), new Counter(29));
