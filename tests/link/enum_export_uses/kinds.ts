// The exporter: an enum, and a function whose signature names it, so the
// importer's IR has a `declare` whose parameter is the enum's `i32`.
export enum Kind {
  If = 1,
  While = 2,
  Return = 3,
}

export const weight = (k: Kind): i32 => {
  switch (k) {
    case Kind.If:
      return 10;
    case Kind.While:
      return 20;
    default:
      return 30;
  }
};
