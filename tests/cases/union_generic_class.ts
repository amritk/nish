// A union is a generic class's type argument: `Box<Shape>` holds one
// `%union.tagged*`, the field a hand-written `ShapeBox` would have, and a
// variant enters it at every `T` the class takes, a constructor's or a
// method's parameter, a nested instance, a `T[]` and either arm of a `??`
// or a ternary.
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32;
  constructor(r: i32) {
    this.r = r;
  }
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32;
  constructor(side: i32) {
    this.side = side;
  }
}

type Shape = Circle | Square;

const area = (s: Shape): i32 => {
  switch (s.kind) {
    case Kind.Circle:
      return 3 * s.r * s.r;
    case Kind.Square:
      return s.side * s.side;
  }
};

const pick = (n: i32): Shape => (n > 0 ? new Circle(n) : new Square(-n));

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
  get(): T {
    return this.value;
  }
  put(value: T): void {
    this.value = value;
  }
}

class Stack<T> {
  items: T[];
  constructor() {
    this.items = [];
  }
  push(item: T): void {
    this.items.push(item);
  }
  at(i: i32): T {
    return this.items[i];
  }
  size(): i32 {
    return this.items.length;
  }
}

export const main = (): void => {
  const b = new Box<Shape>(new Circle(2));
  console.log(area(b.get()));
  b.put(new Square(3));
  console.log(area(b.value));

  const bb = new Box<Box<Shape>>(new Box<Shape>(new Square(4)));
  console.log(area(bb.value.value));

  const st = new Stack<Shape>();
  st.push(new Circle(1));
  st.push(new Square(5));
  st.push(pick(-2));
  let total = 0;
  for (let i = 0; i < st.size(); i++) {
    total += area(st.at(i));
  }
  console.log(total);

  const missing: Box<Shape> | null = total > 100 ? b : null;
  const fallback: Shape = missing?.value ?? new Circle(9);
  console.log(area(fallback));
  const either = new Box<Shape>(total > 0 ? new Circle(1) : new Square(1));
  console.log(area(either.value));
};
