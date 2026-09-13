// A method takes its class's type arguments and adds none of its own: the
// instantiation key would be the receiver's tuple times the method's. WP18 §2.
class Holder {
  value: i32 = 0;

  get<T>(x: T): T {
    return x;
  }
}

export const test = (): number => 0;
