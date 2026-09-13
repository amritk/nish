// NL2063: There is no overloading, so a second constructor is refused rather than merged.
class Point {
  x: i32;
  constructor() {
    this.x = 0;
  }
  constructor(x: i32) {
    this.x = x;
  }
}
