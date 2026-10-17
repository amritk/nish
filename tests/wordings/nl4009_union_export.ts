// NL4009 (with --emit-header): an exported function that takes a union.
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

export const tagOf = (m: Dot | Box): Kind => m.kind;
