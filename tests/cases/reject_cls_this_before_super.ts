class Base {
  x: number;

  constructor(x: number) {
    this.x = x;
  }
}

class Derived extends Base {
  y: number = 2;

  constructor() {
    super(this.y);
  }
}
