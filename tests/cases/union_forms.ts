// The other ways to spell and reach a discriminated union: a member list
// written in place, `(Circle | Square)[]`, an alias that names another union
// (`Shape` flattens `Round | Tri`), a smaller union widened into a larger
// one, a nullable union in a field, a local and an array element, read for
// its tag after a null test, an interface variant pushed straight into a
// `Shape[]`, and a `Shape[][]`.
enum Kind {
  Circle,
  Square,
  Tri,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 1;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 2;
}

interface Tri {
  readonly kind: Kind.Tri;
  base: i32;
}

type Round = Circle | Square;
type Shape = Round | Tri;

const tagOf = (s: Circle | Square): i32 => (s.kind === Kind.Circle ? 1 : 2);

const widen = (r: Round): Shape => r;

const weight = (s: Shape): i32 => {
  if (s.kind === Kind.Circle) {
    return 1;
  }
  if (s.kind === Kind.Square) {
    return 10;
  }
  return 100;
};

const maybe = (m: Shape | null): i32 => {
  if (m === null) {
    return 0;
  }
  return weight(m);
};

class Slot {
  held: Shape | null = null;
}

export const main = (): void => {
  const pair: (Circle | Square)[] = [new Square(), new Circle()];
  console.log(`${tagOf(pair[0])} ${tagOf(pair[1])}`);
  const r: Round = pair[0];
  const wide: Shape = widen(r);
  const shapes: Shape[] = [wide, pair[1]];
  const t: Tri = { kind: Kind.Tri, base: 5 };
  shapes.push(t);
  let total = 0;
  for (const s of shapes) {
    total = total + weight(s);
  }
  console.log(total);
  const slot = new Slot();
  console.log(maybe(slot.held));
  slot.held = shapes[2];
  const held = slot.held;
  if (held !== null) {
    console.log(held.kind === Kind.Tri);
  }
  const none: Shape | null = null;
  const holes: (Shape | null)[] = [none, slot.held];
  let seen = 0;
  for (const h of holes) {
    if (h !== null) {
      seen = seen + weight(h);
    }
  }
  console.log(seen);
  const grid: Shape[][] = [shapes, [t, wide]];
  console.log(`${grid.length} ${grid[1].length} ${weight(grid[1][0])} ${grid[0][2].kind === Kind.Tri}`);
};
