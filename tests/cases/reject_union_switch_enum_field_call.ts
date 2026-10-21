// A plain enum field assigned from a union tag is not a tag read: `poison`
// overwrites `b.k` with `Kind.Tri` behind the checker's back, so the switch
// stays open and `f` can end without a return.
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

const f = (b: Box, s: Shape): i32 => {
  b.k = s.kind;
  poison(b);
  switch (b.k) {
    case Kind.Circle:
      return 1;
    case Kind.Square:
      return 2;
  }
};
