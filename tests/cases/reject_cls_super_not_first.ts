class Base {
  x: number;

  constructor(x: number) {
    this.x = x;
  }
}

class Derived extends Base {
  y: number = 0;

  constructor() {
    const start = 1;
    super(start);
  }
}
