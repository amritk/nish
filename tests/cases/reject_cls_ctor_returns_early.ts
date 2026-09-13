// Every field is assigned on every path out of the constructor.
export class Point {
  x: number;
  constructor(ready: boolean) {
    if (!ready) {
      return;
    }
    this.x = 1;
  }
}
