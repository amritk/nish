// WP18 G8: a method's constraint is resolved once for every receiver the class
// is instantiated at, so it may not mention the class's type parameter — the
// reason NL2326 gives for a function's constraint naming a parameter.
interface Shape {
  area: i32;
}

class Box<T extends Shape> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  same<U extends Box<T>>(u: U): i32 {
    return 0;
  }
}

export const test = (): number => 0;
