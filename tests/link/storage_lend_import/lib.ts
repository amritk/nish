// The callees `main.ts` lends storage to: `good` only indexes and reads the
// length, and `fwd` lends its parameter on to `good`.
export function good(a: Int32Array): i32 {
  let s: i32 = 0
  for (let i = 0; i < a.length; i++) {
    s += a[i]
  }
  return s
}

export function fwd(a: Int32Array): i32 {
  return good(a)
}
