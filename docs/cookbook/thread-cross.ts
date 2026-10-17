import { scope } from "nish/threads"

const label = (n: i32): string => `task-${n}`

export const total = (): i32 => {
  const out: string[] = ["", ""]
  {
    using s = scope()
    s.spawn(label, 1, out, 0)
    s.spawn(label, 22, out, 1)
  }
  return out[0].length + out[1].length
}
