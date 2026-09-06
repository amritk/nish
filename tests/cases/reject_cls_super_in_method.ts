class Base {
  x: number = 0;
}

class Derived extends Base {
  reset(): void {
    super();
  }
}
