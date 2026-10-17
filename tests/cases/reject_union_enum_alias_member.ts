// An alias of an enum is not a variant, so a union naming it falls to the
// general refusal.
enum Kind {
  Circle,
  Ring,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
}

type K = Kind;

type Shape = Circle | K;

export const main = (): void => {
  const s: Shape = new Circle();
  console.log(s.kind === Kind.Circle);
};
