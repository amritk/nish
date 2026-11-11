// WP51 stage 1: an escape join on a string parameter. `a` only hands `s` to
// `count`, which this compiler counts as keeping a string, so the message
// names that call rather than saying `a` keeps `s` itself (NL2736).
type H = (s: string) => i32

const count = (s: string): i32 => s.length

const a = (s: string): i32 => {
  return count(s)
}

const b = (s: string): i32 => {
  return s.length + 1
}

export const main = (): void => {
  const hs: H[] = [a, b]
  let i = 0
  let total = 0
  while (i < 4) {
    total = total + hs[i % 2]("xy")
    i = i + 1
  }
  console.log(`${total}`)
}
