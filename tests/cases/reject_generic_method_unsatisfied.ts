// WP18 G8: a method's constraint is held at each call, where the type argument
// was inferred. `Point` declares no `implements Shape`, so `apply(p)` is
// refused at the call, in the words a generic function's request is.
interface Shape {
  area: i32;
}

class Point {
  area: i32 = 1;
}

class Scale {
  factor: i32 = 2;

  apply<U extends Shape>(u: U): i32 {
    return u.area * this.factor;
  }
}

export const test = (): number => new Scale().apply(new Point());
