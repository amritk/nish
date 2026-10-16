// An enum member type, `Kind.Array`, is a slot that holds exactly that member:
// a readonly tag field initialised with it, an interface field an object
// literal sets, a parameter, a return and a local. In IR it is the enum's
// `i32`, so every slot here lowers exactly as it would typed `Kind`, and a
// read of one is a `Kind` the switch and `===` compare as any other.
enum Kind {
  Scalar,
  Array,
  Missing,
}

interface ScalarNode {
  readonly kind: Kind.Scalar;
  width: i32;
}

class ArrayNode {
  readonly kind: Kind.Array = Kind.Array;
  items: i32;
  constructor(items: i32) {
    this.items = items;
  }
}

const weight = (k: Kind): i32 => {
  switch (k) {
    case Kind.Scalar:
      return 1;
    case Kind.Array:
      return 10;
    default:
      return 100;
  }
};

const missing = (): Kind.Missing => Kind.Missing;

// A value already of the member type enters another slot of it.
const keep = (k: Kind.Array): Kind.Array => k;

export const test = (): number => {
  const s: ScalarNode = { kind: Kind.Scalar, width: 4 };
  const a = new ArrayNode(3);
  const m: Kind.Missing = missing();
  const tag = keep(a.kind);
  const same = tag === Kind.Array ? 1000 : 0;
  return weight(s.kind) + weight(a.kind) + weight(m) + s.width + a.items + same;
};
