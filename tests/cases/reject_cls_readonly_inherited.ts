class Base {
  readonly id: number;

  constructor(id: number) {
    this.id = id;
  }
}

class Derived extends Base {
  constructor() {
    super(1);
    this.id = 2;
  }
}
