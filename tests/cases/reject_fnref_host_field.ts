// WP51 §5.2: a class an exported signature reaches is laid out for the host,
// so a reference field in it is one the host could forge.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

export class Stage {
  op: F
  constructor() {
    this.op = inc
  }
}

export const run = (s: Stage, x: i32): i32 => s.op(x)
