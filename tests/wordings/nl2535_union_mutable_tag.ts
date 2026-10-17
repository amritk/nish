// NL2535: a variant whose tag is not readonly.
enum Kind {
  Dot,
  Box,
}

interface Dot {
  readonly kind: Kind.Dot;
  x: i32;
}

interface Box {
  kind: Kind.Box;
  side: i32;
}

export const tagOf = (m: Dot | Box): Kind => m.kind;
