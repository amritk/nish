// An alias of a scalar is not a variant, so a union naming it falls to the
// general refusal.
enum Kind {
  Circle,
  Ring,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
}

type Count = i32;

type Shape = Circle | Count;

export const main = (): void => {
  const s: Shape = new Circle();
  console.log(s.kind === Kind.Circle);
};
