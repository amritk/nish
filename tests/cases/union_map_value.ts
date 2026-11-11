// A `Map`'s value may be a union: the map stores it as it is, the way an
// array stores an element of one. A key may not (`reject_union_map_key`).
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 1;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 2;
}

type Shape = Circle | Square;

const area = (s: Shape): i32 => (s.kind === Kind.Circle ? s.r * 3 : s.side * s.side);

export const main = (): void => {
  const m = new Map<string, Shape>();
  m.set("a", new Circle());
  m.set("b", new Square());
  const got = m.get("b");
  if (got !== undefined) {
    console.log(area(got));
  }
  m.delete("a");
  for (const s of m.values()) {
    console.log(area(s));
  }
  console.log(m.size);
};
