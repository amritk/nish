// How control leaves a `switch` on a union's tag. A `default` makes a switch
// on a plain enum field compile, where the labels alone leave it open (the
// field can hold `Kind.Tri` however it was assigned). A complete switch whose
// clauses `break` reaches the statement after it, a complete switch nests in
// another's clause, and a `continue` clause skips the rest of its loop body.
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

type Shape = Circle | Square;

class Box {
  k: Kind = Kind.Circle;
}

const poison = (b: Box): void => {
  b.k = Kind.Tri;
};

const boxed = (b: Box, s: Shape): i32 => {
  b.k = s.kind;
  poison(b);
  switch (b.k) {
    case Kind.Circle:
      return 1;
    case Kind.Square:
      return 2;
    default:
      return 3;
  }
};

const broken = (s: Shape): i32 => {
  let n = 0;
  switch (s.kind) {
    case Kind.Circle:
      n = 1;
      break;
    case Kind.Square:
      n = 2;
      break;
  }
  return n + 10;
};

const nested = (s: Shape, t: Shape): i32 => {
  switch (s.kind) {
    case Kind.Circle:
      switch (t.kind) {
        case Kind.Circle:
          return 11;
        case Kind.Square:
          return 12;
      }
    case Kind.Square:
      switch (t.kind) {
        case Kind.Circle:
          return 21;
        case Kind.Square:
          return 22;
      }
  }
};

const skipped = (shapes: Shape[]): i32 => {
  let n = 0;
  for (const s of shapes) {
    switch (s.kind) {
      case Kind.Circle:
        continue;
      case Kind.Square:
        n = n + 1;
        break;
    }
    n = n + 100;
  }
  return n;
};

export const main = (): void => {
  const shapes: Shape[] = [new Circle(), new Square(), new Circle(), new Square()];
  console.log(`${boxed(new Box(), shapes[1])} ${broken(shapes[0])} ${broken(shapes[1])}`);
  console.log(`${nested(shapes[0], shapes[1])} ${nested(shapes[1], shapes[0])}`);
  console.log(`${skipped(shapes)}`);
};
