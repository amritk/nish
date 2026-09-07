// A `case` label is a compile-time constant; a variable belongs in an `if`.
function f(n: number, k: number): number {
  switch (n) {
    case k:
      return 1;
    default:
      return 0;
  }
}
