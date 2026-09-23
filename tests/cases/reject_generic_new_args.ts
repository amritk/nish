// A constructor argument of the wrong type: the label names the instantiation
// the program wrote, `new Box<i32>`, not the template `Box`.
class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

export const test = (): number => new Box<i32>("oops").value;
