// `this` as a value before every field is assigned hands out a half-built struct.
export class Point {
  x: number;
  constructor() {
    const self = this;
    this.x = 1;
  }
}
