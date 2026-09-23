// WP18 G6: a constrained parameter's fields may be written as well as read,
// through the same rule — `shape.area = 0` is admitted because `Shape`
// declares `area`, and the store is to field 0 of `%struct.Circle` in
// `reset$$Circle`, exactly the store a hand-written `Circle` would make.
interface Shape {
  area: i32;
}

class Circle implements Shape {
  area: i32;
  radius: i32;

  constructor(radius: i32) {
    this.area = 3 * radius * radius;
    this.radius = radius;
  }
}

const reset = <T extends Shape>(shape: T): void => {
  shape.area = 0;
};

export const test = (): number => {
  const c = new Circle(2);
  reset(c);
  return c.area + c.radius;
};
