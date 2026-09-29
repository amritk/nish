// `m?()` with no return type annotation: the parser reads both, and the checker
// names the marker, which comes first, rather than the missing annotation.
export class Point {
  m?() {
    return 0;
  }
}
