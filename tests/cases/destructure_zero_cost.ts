// A pattern costs nothing over the reads it stands for: each `*_pattern`
// function compiles to the body of its `*_plain` twin, unoptimised and after
// `opt -O2` (tests/run.js compares them), with the receiver evaluated once,
// no struct copied and no array made.
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

// A fresh array literal: the pattern names the array once, as the twin does.
export const fresh_pattern = (n: number): number => {
  const [a, b] = [n, n + 1]
  return a * 3 + b
}

export const fresh_plain = (n: number): number => {
  const xs = [n, n + 1]
  const a = xs[0]
  const b = xs[1]
  return a * 3 + b
}

// A length guard proves the reads in range for the pattern as for the twin.
export const guard_pattern = (xs: number[]): number => {
  if (xs.length >= 2) {
    const [a, b] = xs
    return a * 3 + b
  }
  return 0
}

export const guard_plain = (xs: number[]): number => {
  if (xs.length >= 2) {
    const a = xs[0]
    const b = xs[1]
    return a * 3 + b
  }
  return 0
}

export const guard_loop_pattern = (xs: number[], n: number): number => {
  let total = 0
  for (let i = 0; i < n; i++) {
    if (xs.length >= 2) {
      const [a, b] = xs
      total = total + a * 3 + b
    }
  }
  return total
}

export const guard_loop_plain = (xs: number[], n: number): number => {
  let total = 0
  for (let i = 0; i < n; i++) {
    if (xs.length >= 2) {
      const a = xs[0]
      const b = xs[1]
      total = total + a * 3 + b
    }
  }
  return total
}

const make = (n: number): Point => new Point(n, n + 1)

// A call on the right is made once: its result is named, then read.
export const call_pattern = (n: number): number => {
  const { x, y } = make(n)
  return x * 3 + y
}

export const call_plain = (n: number): number => {
  const p = make(n)
  const x = p.x
  const y = p.y
  return x * 3 + y
}

// A hole skips its position: no read is made for it.
export const hole_pattern = (xs: number[]): number => {
  const [a, , c] = xs
  return a * 3 + c
}

export const hole_plain = (xs: number[]): number => {
  const a = xs[0]
  const c = xs[2]
  return a * 3 + c
}

// `let` names are plain locals, assigned like any other.
export const let_pattern = (p: Point): number => {
  let { x, y } = p
  x = x + y
  y = y * 2
  return x * 3 + y
}

export const let_plain = (p: Point): number => {
  let x = p.x
  let y = p.y
  x = x + y
  y = y * 2
  return x * 3 + y
}

// An array head over the rows of a `T[][]`.
export const rows_pattern = (rows: number[][]): number => {
  let total = 0
  for (const [a, b] of rows) {
    total = total + a * 3 + b
  }
  return total
}

export const rows_plain = (rows: number[][]): number => {
  let total = 0
  for (const row of rows) {
    const a = row[0]
    const b = row[1]
    total = total + a * 3 + b
  }
  return total
}

// A receiver that is not a name (`h.pt`, `h.items`) is bound to a hidden
// copy of its pointer, so unoptimised it costs one alloca more than the
// twin; after `opt -O2` the bodies are the same (compared at -O2 only).
class Holder {
  pt: Point
  items: number[]
  constructor(pt: Point, items: number[]) {
    this.pt = pt
    this.items = items
  }
}

export const member_pattern = (h: Holder): number => {
  const { x, y } = h.pt
  const [a, b] = h.items
  return x * 3 + y + a * b
}

export const member_plain = (h: Holder): number => {
  const x = h.pt.x
  const y = h.pt.y
  const a = h.items[0]
  const b = h.items[1]
  return x * 3 + y + a * b
}

export const main = (): void => {
  const p = new Point(2, 5)
  const xs = [4, 7]
  const points = [new Point(1, 2), new Point(3, 4)]
  console.log(object_pattern(p) === object_plain(p))
  console.log(array_pattern(xs) === array_plain(xs))
  console.log(for_pattern(points) === for_plain(points))
  console.log(local_pattern(5) === local_plain(5))
  console.log(fresh_pattern(4) === fresh_plain(4))
  console.log(guard_pattern(xs) === guard_plain(xs))
  console.log(guard_loop_pattern(xs, 3) === guard_loop_plain(xs, 3))
  console.log(call_pattern(6) === call_plain(6))
  const ys = [1, 2, 3]
  console.log(hole_pattern(ys) === hole_plain(ys))
  console.log(let_pattern(p) === let_plain(p))
  const rows = [[1, 2], [3, 4]]
  console.log(rows_pattern(rows) === rows_plain(rows))
  const h = new Holder(p, xs)
  console.log(member_pattern(h) === member_plain(h))
}
