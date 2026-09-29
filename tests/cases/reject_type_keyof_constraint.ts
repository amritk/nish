// `keyof` in a constraint and again after it, in a function, a class and a
// method. The pass 1 sweep reads a declaration in source order, constraints
// included, so each reports its constraint's `keyof` and nothing else: the
// constraint's own resolution stays quiet about a form the sweep refused.
// `tests/run.js` pins the three through `--json`.
interface Foo {
  x: i32
}

interface Bar {
  y: i32
}

export const pick = <T extends keyof Foo>(t: T, k: keyof Bar): i32 => 0

export class Box<T extends keyof Foo> {
  key: keyof Bar = 0
}

export class Picker {
  choose<T extends keyof Foo>(t: T, k: keyof Bar): i32 {
    return 0
  }
}
