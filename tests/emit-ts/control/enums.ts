// A numeric enum becomes a `const` object with the checker's member values and
// a type of the same name, and a member written as a type becomes the type of
// that member. Nish has no string enums, so every value is a number.
export enum Shape {
  Circle,
  Square = 4,
  Triangle,
  Hole = -1,
}

enum Level { Low = 10, High }

const sides = (s: Shape): i32 => {
  switch (s) {
    case Shape.Circle:
      return 0
    case Shape.Square:
      return 4
    case Shape.Triangle:
      return 3
    default:
      return -1
  }
}

export const main = (): number => {
  const all: Shape[] = [Shape.Circle, Shape.Square, Shape.Triangle, Shape.Hole]
  for (const s of all) {
    console.log(sides(s))
  }
  const square: Shape.Square = Shape.Square
  console.log(square === Shape.Square)
  const l: Level = Level.High
  console.log(l === Level.High ? "high" : "low")
  return 0
}
