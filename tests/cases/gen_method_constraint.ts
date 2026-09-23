// WP18 G8: a method type parameter may be constrained, and it works as a
// function's does (§15.6): `u.area` through a `U extends Shape` is a direct
// read of field 0 of `%struct.Circle` or `%struct.Square` — no `bitcast`, no
// indirection — and satisfaction is checked at each call. Inside a generic
// class the method's own `U` answers from its own constraint while the
// class's `T` keeps the class's.
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

class Scale {
  factor: i32 = 2;

  apply<U extends Shape>(u: U): i32 {
    return u.area * this.factor;
  }
}

class Tally<T extends Shape> {
  base: T;

  constructor(base: T) {
    this.base = base;
  }

  plus<U extends Shape>(u: U): i32 {
    return this.base.area + u.area;
  }
}

export const test = (): number => {
  const scale = new Scale();
  const tally = new Tally<Square>(new Square(1));
  return scale.apply(new Circle(1)) + scale.apply(new Square(2)) + tally.plus(new Circle(2));
};
