// NL2302 on a generic method: its own list, not its class's, repeats `U`.
class Box {
  value: i32 = 0;
  constructor(value: i32) {
    this.value = value;
  }
  pick<U, U>(a: U, b: U): U {
    return a;
  }
}

export const main = (): i32 => new Box(1).value;
