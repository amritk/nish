// Generic instances over a union built in a loop, and a `Result` whose `Ok`
// payload escapes the helper that built it: the boxes and the variants they
// hold live past the iteration that made them, so escape analysis has to see
// the variant flow through the `T` field and the `Ok` payload (the `.arena`
// golden pins where each allocation lands). Then a write through a narrowed
// `Circle` is read back through the union: the two accesses use different
// TBAA tags, so the output pins that the read is not reordered above the
// write at -O2.
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

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

const build = (n: i32): Result<Shape, string> => {
  if (n % 5 === 0) {
    return Err(`skip ${n}`);
  }
  return n % 2 === 0 ? Ok(new Circle(n)) : Ok(new Square(n));
};

const grow = (s: Shape): void => {
  if (s.kind === Kind.Circle) {
    s.r = s.r + 10;
  }
};

export const main = (): void => {
  const boxes: Box<Shape>[] = [];
  let skipped = 0;
  for (let i = 1; i <= 8; i++) {
    const r = build(i);
    if (r.ok) {
      boxes.push(new Box<Shape>(r.value));
    } else {
      skipped = skipped + 1;
      console.log(r.error);
    }
  }
  let total = 0;
  for (const b of boxes) {
    total = total + area(b.value);
  }
  console.log(`boxes ${boxes.length} skipped ${skipped} total ${total}`);

  const held = boxes[1].value;
  const before = area(held);
  grow(held);
  const after = area(boxes[1].value);
  console.log(`before ${before} after ${after}`);
};
