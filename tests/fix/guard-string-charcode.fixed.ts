// NL9007 on `charCodeAt`: the guard is the same, against the string's length.
const hashAt = (s: string, idx: i32[]): i32 => {
  let h = 0
  for (const i of idx) {
    if (!(i >= 0 && i < toI32(s.length))) { panic("index out of range") }
    h = h * 31 + s.charCodeAt(i)
  }
  return h
}

export const main = (): number => {
  console.log(`${hashAt("nish", [3, 0, 1])}`)
  return 0
}
