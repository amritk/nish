// NL2703: Which fields a union value has depends on the variant it holds, so a spread
// of one is refused until it is narrowed.
enum Kind {
  Dot,
  Box,
}

interface Dot {
  readonly kind: Kind.Dot;
  x: i32;
}

interface Box {
  readonly kind: Kind.Box;
  side: i32;
}

interface Out {
  kind: Kind;
  x: i32;
}

export const pick = (m: Dot | Box): i32 => {
  const o: Out = { ...m, x: 1 };
  return o.x;
};

export const main = (): i32 => {
  const d: Dot = { kind: Kind.Dot, x: 3 };
  return pick(d);
};
