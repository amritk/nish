// Recursive sums in methods the loop must not take (issue #1612); each
// compiles as plain recursion (no `rec.head` in acc_method_ineligible.ll).
//
// Nish has no inheritance, no method in an interface and no method call on
// a union (docs/LANGUAGE.md), so an overridden or interface-dispatched
// method cannot be written, and no `static` method either; the dynamic calls
// a method can make are the ones below.

type Step = (n: i32) => i32

const inc = (n: i32): i32 => n + 1

// The call goes through a function-valued field: a dispatched call, not a
// method call, so never a step.
class Indirect {
  step: Step
  constructor(step: Step) {
    this.step = step
  }

  run(n: i32): i32 {
    if (n <= 0) {
      return 0
    }
    return n + this.step(n - 1)
  }
}

// A method of the same name on another class: `other.walk` is not this
// method, so neither `walk` recurses.
class Ping {
  other: Pong | null
  constructor(other: Pong | null) {
    this.other = other
  }

  walk(n: i32): i32 {
    const other = this.other
    if (n <= 0 || other === null) {
      return 0
    }
    return n + other.walk(n - 1)
  }
}

class Pong {
  other: Ping | null
  constructor(other: Ping | null) {
    this.other = other
  }

  walk(n: i32): i32 {
    const other = this.other
    if (n <= 0 || other === null) {
      return 0
    }
    return n + other.walk(n - 1)
  }
}

// A method of a generic class: each instantiation is its own copy.
class Box<T> {
  item: T
  constructor(item: T) {
    this.item = item
  }

  count(n: i32): i32 {
    if (n <= 0) {
      return 0
    }
    return n + this.count(n - 1)
  }
}

// `self(args) + Y` with `Y` a field: the recursion runs before the field is
// read and could assign it, so only numbers and parameters are `Y`.
class Tail {
  f: i32
  constructor(f: i32) {
    this.f = f
  }

  m(n: i32): i32 {
    if (n <= 0) {
      return 0
    }
    return this.m(n - 1) + this.f
  }
}

// An optional call: `r?.m(...)` may not run, so its sum is not a step.
class Opt {
  next: Opt | null
  constructor(next: Opt | null) {
    this.next = next
  }

  m(n: i32): i32 {
    if (n <= 0) {
      return 0
    }
    const r = this.next
    return n + (r?.m(n - 1) ?? 0)
  }
}

export const main = (): i32 => {
  const pong = new Pong(null)
  const ping = new Ping(pong)
  pong.other = ping
  const box = new Box<string>("x")
  const opt = new Opt(null)
  opt.next = new Opt(opt)
  console.log(`${new Indirect(inc).run(10)} ${ping.walk(10)} ${box.count(10)} ${new Tail(2).m(10)} ${opt.m(10)}`)
  return 0
}
