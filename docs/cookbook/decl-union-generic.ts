enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle
  r: i32 = 3
}

class Square {
  readonly kind: Kind.Square = Kind.Square
  side: i32 = 4
}

type Shape = Circle | Square

class Box<T> {
  value: T
  constructor(value: T) {
    this.value = value
  }
}

class ShapeBox {
  value: Shape
  constructor(value: Shape) {
    this.value = value
  }
}

const viaBox = (): Kind => new Box<Shape>(new Circle()).value.kind

const viaShapeBox = (): Kind => new ShapeBox(new Circle()).value.kind

export const main = (): number => {
  console.log(viaBox() === viaShapeBox() ? "same" : "different")
  return 0
}
