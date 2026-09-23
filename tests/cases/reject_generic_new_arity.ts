// A generic class with no constructor takes no arguments, and the arity error
// names the instantiation, `new Box<i32>`.
class Box<T> {
  count: i32 = 0;
}

export const test = (): number => new Box<i32>(1).count;
