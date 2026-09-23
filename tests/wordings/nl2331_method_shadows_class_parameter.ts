// NL2331: a method type parameter with the name of one of its class's (WP18
// G8). Both are in scope in the method's body, so every `T` there — in an
// annotation, a constraint or a diagnostic — would have two meanings.
class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  also<T>(other: T): T {
    return other;
  }
}

export const main = (): i32 => new Box<i32>(1).value;
