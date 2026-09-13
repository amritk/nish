// A static block is top-level code inside a class, and there is no top-level code.
export class Point {
  x: number = 0;
  static {
    const n = 1;
  }
}
