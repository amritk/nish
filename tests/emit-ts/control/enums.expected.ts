// A numeric enum becomes a `const` object with the checker's member values and
// a type of the same name, and a member written as a type becomes the type of
// that member. Nish has no string enums, so every value is a number.
import type { i32 } from "nish/runtime"
export const Shape = {
  Circle: 0,
  Square: 4,
  Triangle: 5,
  Hole: -1,
} as const;
export type Shape = (typeof Shape)[keyof typeof Shape];

const Level = { Low: 10, High: 11 } as const;
type Level = (typeof Level)[keyof typeof Level];

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
  const square: (typeof Shape.Square) = Shape.Square
  console.log(square === Shape.Square)
  const l: Level = Level.High
  console.log(l === Level.High ? "high" : "low")
  return 0
}
