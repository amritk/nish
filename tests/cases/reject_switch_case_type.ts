// A `case` label has the discriminant's type; there is no implicit widening.
const WIDE: i64 = 1;

function f(n: number): number {
  switch (n) {
    case WIDE:
      return 1;
    default:
      return 0;
  }
}
