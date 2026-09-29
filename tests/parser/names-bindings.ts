// The readings WP33 R1's fourth stage keeps. It reads `get` and `set` before a
// member's name as an accessor, in a class and in an interface, a method
// signature in an interface, a destructuring pattern where a name is bound, a
// default, optional or rest parameter, a function with no body or return
// type, an anonymous default function and the names after the first arrow of
// a `const` — each at a position that was a syntax error before. None of those
// is in this file, which holds the programs beside them that already
// compiled, and every one compiles as it did, to the same bytes: `get` and
// `set` as class fields, methods and locals and as interface fields, `get`
// alone on its line before a method's parameters or a field's type, a body on
// the line after its signature, a parenthesised assignment, object literal and
// array literal where an arrow's parameters could open, arrows passed as
// arguments, and several declarators in a `for` head, a local and a module
// constant.
//
// `tests/run.js` compiles it and reads the members and functions out of the IR.
class Accessors {
  get: i32 = 1
  set: i32 = 2
  value: i32 = 0

  get2(): i32 {
    return this.get
  }
}

class GetSet {
  get(): i32 {
    return 1
  }

  set(v: i32): void {
    const get = v
    const set = get + 1
    console.log(`${set}`)
  }

  set2(): i32 {
    return 3
  }
}

class LineBreaks {
  get
  (): i32 {
    return 4
  }
}

interface Pair {
  get: i32
  set: i32
}

interface Wrapped {
  get
  : i32
  set
  : i32
}

const LOW: i32 = 1, HIGH: i32 = 2

const apply = (f: (x: i32) => i32, v: i32): i32 => f(v)

function body(n: i32): i32
{
  return n + 1
}

const twice = (n: i32): i32 => n * 2

export function main(): void {
  let x: i32 = 0
  ;(x = 1)
  const y = (x = 2)
  for (let i = 0, j = 10; i < j; i++) {
    x = x + i
  }
  const a = 1, b = 2
  const p: Pair = { get: 1, set: 2 }
  const w: Wrapped = { get: p.set, set: p.get }
  const g = new GetSet()
  g.set(p.get + p.set)
  const flag = x > 0
  const pick = flag ? (a) : (b)
  const arr = flag ? ([a, b]) : ([b])
  const q: Pair = flag ? ({ get: LOW, set: HIGH }) : ({ get: HIGH, set: LOW })
  const r: Pair = ({ get: q.set, set: q.get })
  console.log(`${x} ${y} ${a} ${b} ${pick} ${arr.length} ${apply((v) => v + 1, 2)} ${apply((v: i32): i32 => v * 2, 3)} ${body(1)} ${twice(2)} ${q.get} ${r.get} ${w.get}`)
}
