// A pattern costs nothing over the reads it stands for: each `*_pattern`
// function compiles, after `opt -O2`, to the body of its `*_plain` twin
// (tests/run.js compares them), with the receiver evaluated once, no
// struct copied and no array made.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

export const object_pattern = (p: Point): number => {
  const { x, y } = p
  return x * 3 + y
}

export const object_plain = (p: Point): number => {
  const x = p.x
  const y = p.y
  return x * 3 + y
}

export const array_pattern = (xs: number[]): number => {
  const [a, b] = xs
  return a * 3 + b
}

export const array_plain = (xs: number[]): number => {
  const a = xs[0]
  const b = xs[1]
  return a * 3 + b
}

export const for_pattern = (points: Point[]): number => {
  let total = 0
  for (const { x, y } of points) {
    total = total + x * 3 + y
  }
  return total
}

export const for_plain = (points: Point[]): number => {
  let total = 0
  for (const point of points) {
    const x = point.x
    const y = point.y
    total = total + x * 3 + y
  }
  return total
}

// The elements of a local array read through a for-of head pattern are
// allocated as they are for a named loop variable: the pattern adds none.
export const local_pattern = (n: number): number => {
  const points = [new Point(n, 2), new Point(3, n)]
  let total = 0
  for (const { x, y } of points) {
    total = total + x * 3 + y
  }
  return total
}

export const local_plain = (n: number): number => {
  const points = [new Point(n, 2), new Point(3, n)]
  let total = 0
  for (const point of points) {
    const x = point.x
    const y = point.y
    total = total + x * 3 + y
  }
  return total
}

export const main = (): void => {
  const p = new Point(2, 5)
  const xs = [4, 7]
  const points = [new Point(1, 2), new Point(3, 4)]
  console.log(object_pattern(p) === object_plain(p))
  console.log(array_pattern(xs) === array_plain(xs))
  console.log(for_pattern(points) === for_plain(points))
  console.log(local_pattern(5) === local_plain(5))
}
