// `j === k`, with `k` holding `Kind.Circle | Kind.Square`, leaves `j` one of
// the two where they are equal, so a comparison with `Kind.Tri` there is
// always false, as TypeScript says.
enum Kind {
  Circle,
  Square,
  Tri,
}

const f = (j: Kind, n: i32): i32 => {
  const k: Kind = n > 1 ? Kind.Circle : Kind.Square;
  if (j === k) {
    return j === Kind.Tri ? 1 : 0;
  }
  return 2;
};

export const main = (): void => {
  console.log(f(Kind.Circle, 2));
};
