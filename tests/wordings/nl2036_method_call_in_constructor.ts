// NL2036: A method called in the constructor could read a field that is not assigned yet.
class Point {
  x: i32;
  constructor() {
    this.scale();
    this.x = 0;
  }
  scale(): void {}
}
