// Two constructors are an overload set, and there is no overloading.
export class Point {
  x: number = 0;
  constructor() {}
  constructor(x: number) {
    this.x = x;
  }
}
