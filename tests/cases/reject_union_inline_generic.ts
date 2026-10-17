// A generic class written in the union itself is not a member a tagged
// union can have, so the union falls to the general refusal.
enum Kind {
  Circle,
  Ring,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
}

class Ring<T> {
  readonly kind: Kind.Ring = Kind.Ring;
  size: T;
  constructor(size: T) {
    this.size = size;
  }
}

const tagOf = (s: Circle | Ring<i32>): Kind => s.kind;

export const main = (): void => {
  console.log(tagOf(new Circle()) === Kind.Circle);
};
