// A declaration directly in a clause would be visible but unassigned in the
// clauses below it; the braces make its scope the clause.
function f(n: number): number {
  switch (n) {
    case 1:
      const doubled = n * 2;
      return doubled;
    default:
      return 0;
  }
}
