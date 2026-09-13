// Two parameters of one name: the second would shadow the first with no way to reach it.
export class Point {
  x: number;
  constructor(x: number, x: number) {
    this.x = x;
  }
}
