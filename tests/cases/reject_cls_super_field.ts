class Base {
  x: number = 1;
}

class Derived extends Base {
  read(): number {
    return super.x;
  }
}
