// A local a ternary of two members initialises holds one of the two, as
// TypeScript joins the arms, so a comparison with the third is always false.
enum Kind {
  Circle,
  Square,
  Tri,
}

const f = (n: i32): i32 => {
  const k: Kind = n > 1 ? Kind.Circle : Kind.Square;
  return k === Kind.Tri ? 1 : 0;
};

export const main = (): void => {
  console.log(f(2));
};
