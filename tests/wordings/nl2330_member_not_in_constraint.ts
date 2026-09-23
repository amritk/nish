// NL2330: a method the concrete type has and the constraint does not (WP18
// G6). `Shape` is an interface, and an interface has fields only, so no method
// can be called through a `T extends Shape`.
interface Shape {
  area: i32;
}

class Circle implements Shape {
  area: i32 = 12;

  grow(): i32 {
    this.area = this.area * 2;
    return this.area;
  }
}

const grown = <T extends Shape>(shape: T): i32 => shape.grow();

export const main = (): i32 => grown(new Circle());
