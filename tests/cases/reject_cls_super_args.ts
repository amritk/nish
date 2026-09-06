class Base {
  x: number;

  constructor(x: number) {
    this.x = x;
  }
}

class Derived extends Base {
  constructor() {
    super("one");
  }
}
