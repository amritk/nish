enum Kind {
  Circle,
  Square,
  Tri,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle
  r: i32 = 3
}

class Square {
  readonly kind: Kind.Square = Kind.Square
  side: i32 = 4
}

interface Tri {
  readonly kind: Kind.Tri
  base: i32
}

type Shape = Circle | Square | Tri

const sides = (s: Shape): i32 => {
  switch (s.kind) {
    case Kind.Circle:
      return 0
    case Kind.Square:
      return 4
    case Kind.Tri:
      return 3
  }
}

export const main = (): i32 => {
  const t: Tri = { kind: Kind.Tri, base: 2 }
  return sides(t)
}
