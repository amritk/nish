// A string enum's member can tag a union, as a numeric one's can: the tag is
// the member's ordinal in memory, and `String` names it from the table.
enum Kind {
  Dot = "dot",
  Box = "box",
}

class Dot {
  readonly kind: Kind.Dot = Kind.Dot;
  r: i32 = 0;
  constructor(r: i32) {
    this.r = r;
  }
}

class Box {
  readonly kind: Kind.Box = Kind.Box;
  w: i32 = 0;
  h: i32 = 0;
  constructor(w: i32, h: i32) {
    this.w = w;
    this.h = h;
  }
}

type Shape = Dot | Box;

const area = (s: Shape): i32 => {
  switch (s.kind) {
    case Kind.Dot:
      return 3 * s.r * s.r;
    case Kind.Box:
      return s.w * s.h;
  }
};

export const test = (): i32 => {
  const shapes: Shape[] = [new Dot(2), new Box(3, 4)];
  let total = 0;
  for (const s of shapes) {
    console.log(String(s.kind));
    total = total + area(s);
  }
  return total;
};
