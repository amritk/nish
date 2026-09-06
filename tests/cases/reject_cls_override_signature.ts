class Base {
  scale(by: number): number {
    return by;
  }
}

class Derived extends Base {
  scale(by: string): number {
    return by.length;
  }
}
