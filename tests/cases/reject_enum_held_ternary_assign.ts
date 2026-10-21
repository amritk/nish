// An assignment of a ternary of two members leaves the local holding one of
// the two, however it was declared, so a comparison with the third is always
// false, as TypeScript says.
enum Kind {
  Circle,
  Square,
  Tri,
}

const f = (n: i32): i32 => {
  let k: Kind = Kind.Tri;
  k = n > 1 ? Kind.Circle : n > 0 ? Kind.Square : Kind.Circle;
  return k === Kind.Tri ? 1 : 0;
};

export const main = (): void => {
  console.log(f(2));
};
