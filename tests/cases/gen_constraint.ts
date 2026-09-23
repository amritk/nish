// WP18 G6: `<T extends Shape>` may read `Shape`'s members through a `T`, and
// each instantiation reads its own `%struct` directly. `Circle` and `Square`
// `implements Shape`, so `area` is their first field and the read is field 0
// of `%struct.Circle` or of `%struct.Square`: no `bitcast` to `%struct.Shape`,
// no vtable, the load a hand-written `Circle` would make (WP18 §6.5).
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

class Square implements Shape {
  area: i32;

  constructor(side: i32) {
    this.area = side * side;
  }
}

const areaOf = <T extends Shape>(shape: T): i32 => shape.area;

export const test = (): number => areaOf(new Circle(2)) + areaOf(new Square(3));
