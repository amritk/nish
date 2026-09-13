// An optional method would be a null function pointer, and a function is not a value.
export class Point {
  x: number = 0;
  scale?(by: number): number {
    return by;
  }
}
