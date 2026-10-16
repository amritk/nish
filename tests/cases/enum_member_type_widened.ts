// enum_member_type.ts with every member type written as the enum, `Kind`. A
// member type lowers exactly as its enum does, so this case's golden .ll is
// byte for byte enum_member_type.ll: a change that moves one moves the other.
enum Kind {
  Scalar,
  Array,
  Missing,
}

interface ScalarNode {
  readonly kind: Kind;
  width: i32;
}

class ArrayNode {
  readonly kind: Kind = Kind.Array;
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

const missing = (): Kind => Kind.Missing;

// A value already of the member type enters another slot of it.
const keep = (k: Kind): Kind => k;

export const test = (): number => {
  const s: ScalarNode = { kind: Kind.Scalar, width: 4 };
  const a = new ArrayNode(3);
  const m: Kind = missing();
  const tag = keep(a.kind);
  const same = tag === Kind.Array ? 1000 : 0;
  return weight(s.kind) + weight(a.kind) + weight(m) + s.width + a.items + same;
};
