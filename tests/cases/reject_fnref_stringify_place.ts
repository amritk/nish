// WP51 §2.2: a field, an element and a nullable reference are refused by
// `JSON.stringify`, `console.log` and a template hole as a local is: each
// would print the function's source under Node.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

class Box {
  op: F
  constructor(op: F) {
    this.op = op
  }
  show(): string {
    return JSON.stringify(this.op)
  }
}

export const show = (n: F | null): void => {
  console.log(n)
  console.log(`${n}`)
}

export const main = (): void => {
  const fs: F[] = [inc]
  console.log(JSON.stringify(fs[0]))
  console.log(new Box(inc).show())
  show(inc)
}
