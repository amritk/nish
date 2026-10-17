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

const pick = (round: boolean): Shape => (round ? new Circle() : new Square())

const name = (s: Shape): string => (s.kind === Kind.Circle ? "circle" : "square")

export const main = (): number => {
  console.log(name(pick(true)))
  return 0
}
