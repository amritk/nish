// NL2247: a local named `String` is not the global, so calling it is not a
// conversion and there is no fix.
export const test = (): number => {
  const String: i32 = 3
  const s = String(4)
  return s
}
