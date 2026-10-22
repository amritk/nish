// Each arm of an `if` and `else` stores a member, so after them the local
// holds one of the two, and a comparison with the third is always false.
enum Kind {
  Circle,
  Square,
  Tri,
}

const f = (k: Kind, n: i32): i32 => {
  let j: Kind = k;
  if (n > 1) {
    j = Kind.Circle;
  } else {
    j = Kind.Square;
  }
  return j === Kind.Tri ? 1 : 0;
};

export const main = (): void => {
  console.log(f(Kind.Circle, 2));
};
