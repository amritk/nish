export class Base {
  id: number;

  constructor(id: number) {
    this.id = id;
  }

  twice(): number {
    return this.id * 2;
  }
}

export class Derived extends Base {
  bonus: number = 1;

  total(): number {
    return this.twice() + this.bonus;
  }
}
