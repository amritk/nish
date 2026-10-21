// A loop that stores a member leaves the local holding what it held before the
// loop or what the loop stored, after the loop as at its head, so a comparison
// with the third member is always false.
enum Kind {
  Circle,
  Square,
  Tri,
}

const f = (n: i32): i32 => {
  let k: Kind = Kind.Circle;
  let i = 0;
  while (i < n) {
    k = Kind.Square;
    i = i + 1;
  }
  return k === Kind.Tri ? 1 : 0;
};

export const main = (): void => {
  console.log(f(2));
};
