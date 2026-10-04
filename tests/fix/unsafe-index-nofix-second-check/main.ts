// The loop proves `xs[i]` in range, but a compound store whose right side calls
// a function checks its index again after the call, which may have resized the
// array, and the flag drops that second check. `nish:unsafe` has no form of it.
const weight = (i: i32): i32 => i * 2

export const scale = (xs: i32[]): void => {
  for (let i = 0; i < xs.length; i++) {
    xs[i] += weight(i)
  }
}
