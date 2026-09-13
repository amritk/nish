// NL2189: A constructor returns the instance, so it declares no return type.
class Point {
  x: i32;
  constructor(): void {
    this.x = 0;
  }
}
