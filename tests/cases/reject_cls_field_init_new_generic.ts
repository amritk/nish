// A `new` initializer constructs a class with no type parameters.
class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }
}

export class Shelf {
  box: Box<i32> = new Box<i32>(1);
}
