interface Shape {
  area: i32;
}

class Circle implements Shape {
  area: i32;
  radius: i32;

  constructor(radius: i32) {
    this.area = 3 * radius * radius;
    this.radius = radius;
  }
}

class Square implements Shape {
  area: i32;

  constructor(side: i32) {
    this.area = side * side;
  }
}

const areaOf = <T extends Shape>(shape: T): i32 => shape.area;

export const main = (): i32 => areaOf(new Circle(2)) + areaOf(new Square(3));
