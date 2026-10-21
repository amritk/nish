// A `switch` clause that stores a member leaves the local holding what it held
// before the `switch` or what the clause stored, so a comparison with the third
// member is always false.
enum Kind {
  Circle,
  Square,
  Tri,
}

const f = (n: i32): i32 => {
  let k: Kind = Kind.Circle;
  switch (n) {
    case 1:
      k = Kind.Square;
      break;
    default:
      break;
  }
  return k === Kind.Tri ? 1 : 0;
};

export const main = (): void => {
  console.log(f(2));
};
