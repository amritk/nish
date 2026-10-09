const next = (s: string, sub: string, from: number): number => s.indexOf(sub, from)

const count = (s: string, sub: string): number => {
  let n = 0
  let at = s.indexOf(sub, 0)
  while (at >= 0) {
    n = n + 1
    at = s.indexOf(sub, at + sub.length)
  }
  return n
}
