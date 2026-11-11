// A `Map`'s value may be a union: the map stores it as it is, the way an
// array stores an element of one, alone, in an array or with `| null`. A key
// may not (`reject_union_map_key`).
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

  const lists = new Map<string, Shape[]>();
  const both: Shape[] = [new Circle(), new Square()];
  lists.set("both", both);
  const list = lists.get("both");
  if (list !== undefined) {
    console.log(area(list[0]) + area(list[1]));
  }

  const maybe = new Map<string, Shape | null>();
  maybe.set("none", null);
  maybe.set("one", new Circle());
  const none = maybe.get("none");
  if (none !== undefined) {
    console.log(none === null ? 0 : area(none));
  }
  const one = maybe.get("one");
  if (one !== undefined && one !== null) {
    console.log(area(one));
  }
};
