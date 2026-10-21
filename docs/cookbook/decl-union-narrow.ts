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

const size = (s: Shape): i32 => {
  if (s.kind === Kind.Circle) {
    return s.r
  }
  return s.side
}

export const main = (): number => {
  console.log(size(pick(true)))
  return 0
}
