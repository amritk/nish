import { Mutex } from "nish/threads"

class Count {
  n: i32
  constructor(n: i32) {
    this.n = n
  }
}

export function main(): i32 {
  const m = new Mutex<Count>(new Count(1))
  {
    let g = m.lock()
    g.value.n = g.value.n + 41
  }
  {
    using g = m.lock()
    console.log(g.value.n)
  }
  return 0
}
