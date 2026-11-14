// union.ts's twin: the same loop written the way it had to be before WP58 S1
// let a union be a `Result`'s type argument, with the union in a class field,
// `Result<ShapeWrapper, string>`. It allocates the wrapper on every success,
// which union.ts does not.
//
// The accumulator feeds the next input, so the loop has a carried dependency,
// and every result is read, so no call is dead. What a call allocates stays in
// the process's arena until exit, so the peak resident set is what the calls
// add up to; the bytes a success costs are read across one call, after the
// timed loop.
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle
  r: i32
  constructor(r: i32) {
    this.r = r
  }
}

class Square {
  readonly kind: Kind.Square = Kind.Square
  side: i32
  constructor(side: i32) {
    this.side = side
  }
}

type Shape = Circle | Square

class ShapeWrapper {
  shape: Shape
  constructor(shape: Shape) {
    this.shape = shape
  }
}

const parse = (n: i32): Result<ShapeWrapper, string> => {
  if (n % 7 === 0) {
    return Err("bad")
  }
  const shape: Shape = n % 2 === 0 ? new Circle(n & 255) : new Square(n & 255)
  return Ok(new ShapeWrapper(shape))
}

const area = (r: Result<ShapeWrapper, string>): i32 => {
  if (!r.ok) {
    return 1
  }
  const s = r.value.shape
  switch (s.kind) {
    case Kind.Circle:
      return 3 * s.r
    case Kind.Square:
      return s.side
  }
}

export const main = (): i32 => {
  const N = 4000000 // bench:n
  let acc = 1
  for (let i = 0; i < N; i++) {
    acc = (acc + area(parse(i + acc))) & 0xffff
  }
  // A success's bytes: each input is odd and 1 mod 7, so parse gives a
  // `Square`; the bytes are what the arena moved by across the one call.
  // A call that opens a fresh arena chunk reads as a negative delta, so only
  // the calls that stayed in one chunk are counted.
  let bytes: i64 = 0
  let calls: i64 = 0
  for (let i = 0; i < 1000; i++) {
    const before = Arena.used()
    const r = parse(i * 14 + 1)
    const moved = Arena.used() - before
    if (moved >= 0) {
      bytes += moved
      calls += 1
    }
    acc = (acc + area(r)) & 0xffff
  }
  console.log(`acc ${acc} bytes/success ${bytes / calls}`)
  return 0
}
