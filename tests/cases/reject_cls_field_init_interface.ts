// An interface-typed field takes no `new` initializer, even of a class with
// the same fields: build the object in a constructor.
interface Shape {
  n: i32;
}

class Square {
  n: i32 = 4;
}

export class Holder {
  shape: Shape = new Square();
}
