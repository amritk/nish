// A method called before the fields are set would read uninitialised memory.
export class Point {
  x: number;
  constructor() {
    this.scale();
    this.x = 1;
  }
  scale(): number {
    return this.x;
  }
}
