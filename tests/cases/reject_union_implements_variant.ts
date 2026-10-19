// A class that implements an interface variant is not a variant itself:
// `tsc` accepts `Band` where `Circle | Ring` is wanted, and this version
// takes it only once it is converted to `Ring`.
enum Kind {
  Circle,
  Ring,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
}

interface Ring {
  readonly kind: Kind.Ring;
}

class Band implements Ring {
  readonly kind: Kind.Ring = Kind.Ring;
}

type Shape = Circle | Ring;

const tagOf = (s: Shape): Kind => s.kind;

export const main = (): void => {
  console.log(tagOf(new Band()) === Kind.Ring);
};
