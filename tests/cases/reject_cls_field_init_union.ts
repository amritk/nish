// A union-typed field takes no `new` initializer, even of one of its variants:
// build the variant in a constructor.
enum Kind {
  P,
  Q,
}

class P {
  readonly kind: Kind.P = Kind.P;
  n: i32 = 1;
}

class Q {
  readonly kind: Kind.Q = Kind.Q;
  m: i32 = 2;
}

type PQ = P | Q;

export class Holder {
  value: PQ = new P();
}
