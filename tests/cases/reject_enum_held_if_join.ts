// After an `if` whose arm stores another member, the local holds what it was
// declared with or what the arm stored, so a comparison with the third member
// is always false, as TypeScript says.
enum Kind {
  Circle,
  Square,
  Tri,
}

const f = (n: i32): i32 => {
  let k: Kind = Kind.Circle;
  if (n > 1) {
    k = Kind.Square;
  }
  return k === Kind.Tri ? 1 : 0;
};

export const main = (): void => {
  console.log(f(2));
};
