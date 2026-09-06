class Base {
  x: number;

  constructor(x: number) {
    this.x = x;
  }
}

class Derived extends Base {
  y: number;

  constructor() {
    this.y = 1;
  }
}
