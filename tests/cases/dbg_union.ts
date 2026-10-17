// A discriminated union under WP10 `-g`: no basic type describes one, so the
// debug info names a structure spelled as the union is, whose one member is
// the tag every variant keeps at offset 0. Before it, a union parameter, local
// or field ended `-g` with an internal error.
enum Kind {
  Dot,
  Box,
}

interface Dot {
  readonly kind: Kind.Dot;
  x: i32;
}

class Box {
  readonly kind: Kind.Box = Kind.Box;
  side: i32 = 2;
}

type Mark = Dot | Box;

class Sheet {
  first: Mark;
  rest: Mark[];
  spare: Mark | null;
  constructor(first: Mark) {
    this.first = first;
    this.rest = [];
    this.spare = null;
  }
}

const dotOf = (x: i32): Mark => {
  const dot: Dot = { kind: Kind.Dot, x: x };
  return dot;
};

const tagOf = (m: Mark): i32 => (m.kind === Kind.Dot ? 1 : 2);

export const test = (): number => {
  const local: Mark = dotOf(1);
  const sheet = new Sheet(new Box());
  sheet.rest.push(local);
  sheet.spare = local;
  console.log(`${tagOf(local)} ${tagOf(sheet.first)} ${sheet.rest.length} ${sheet.spare === null}`);
  return 0;
};
