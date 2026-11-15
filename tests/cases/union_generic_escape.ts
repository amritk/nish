// Generic instances over a union built in a loop, and a `Result` whose `Ok`
// payload escapes the helper that built it: the boxes and the variants they
// hold live past the iteration that made them, so escape analysis has to see
// the variant flow through the `T` field and the `Ok` payload (the `.arena`
// golden pins where each allocation lands).
//
// `probe` writes `r` through `b.value` narrowed to `Circle`, re-reads the
// value through the `Box<Shape>` field and switches on it through the union
// view; the output pins the arm taken and the value written. No Nish access
// path puts two non-aliasing TBAA tags on the same bytes: a variant's fields
// are reached only through that variant's own tag (`r` is stored and loaded
// under `Circle`'s, here and in `area`), the instance field only through its
// class's tag, and the one shared word, the kind at offset 0, is stored under
// the variant's tag by its constructor and loaded by the union view with no
// tag, which aliases everything. At -O2 `probe` is inlined and its loads are
// forwarded from the stores, so this pins behaviour, not a reordering.
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

const probe = (n: i32): i32 => {
  const b = new Box<Shape>(n % 2 === 0 ? new Circle(n) : new Square(n));
  const v = b.value;
  if (v.kind === Kind.Circle) {
    v.r = v.r + 10;
  }
  const again = b.value;
  switch (again.kind) {
    case Kind.Circle:
      return again.r;
    case Kind.Square:
      return -again.side;
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

  for (let i = 1; i <= 4; i++) {
    console.log(`probe ${i} ${probe(i)}`);
  }
};
