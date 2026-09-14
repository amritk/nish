// One name, one declaration: a declared class after a generic one of the same
// name is refused in the words a duplicate declaration is always refused in.
// Without the check the declared `Box` compiled and was unreachable, because
// `Box` in an annotation resolves to the template.
class Box<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }
}

class Box {
  value: i32;

  constructor(v: i32) {
    this.value = v;
  }
}

export const main = (): i32 => new Box<i32>(7).value;
