// Only an integer `switch` lowers to a jump table, so a string discriminant
// is rejected rather than lowered to a chain of string comparisons.
function f(s: string): number {
  switch (s) {
    case "a":
      return 1;
    default:
      return 0;
  }
}
