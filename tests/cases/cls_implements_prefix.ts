// `implements` is a prefix rule (WP25): the interface's fields are the class's
// *first* fields, and the class may declare more after them. That is what
// replaced inheritance -- the layout is flat, the conversion is one `bitcast`,
// and two classes with different tails are usable through one interface.
interface Shape {
  x: i32;
  y: i32;
}

class Square implements Shape {
  x: i32;
  y: i32;
  side: i32;

  constructor(x: i32, y: i32, side: i32) {
    this.x = x;
    this.y = y;
    this.side = side;
  }
}

class Circle implements Shape {
  x: i32;
  y: i32;
  radius: i32;
  filled: boolean;

  constructor(x: i32, y: i32, radius: i32) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.filled = true;
  }
}

// Reads and writes through the interface reach the class's own bytes.
function shift(s: Shape, dx: i32): i32 {
  s.x = s.x + dx;
  return s.x + s.y;
}

export function main(): number {
  const sq = new Square(1, 2, 10);
  const c = new Circle(3, 4, 20);
  const shapes: Shape[] = [sq, c];
  console.log(shift(shapes[0], 5));
  console.log(shift(shapes[1], 5));
  console.log(sq.x);
  console.log(sq.side);
  console.log(c.radius);
  return 0;
}
