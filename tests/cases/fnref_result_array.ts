// WP51 stage 2: an array of references under a `Result` arm holds the
// element place, so the call through an element read out of `.value`
// dispatches over the functions stored into arrays of that type.
type F = (x: i32) => i32

const plus1 = (x: i32): i32 => x + 1
const minus1 = (x: i32): i32 => x - 1

const make = (up: boolean): Result<F[], string> => {
  if (up) {
    return Ok([plus1])
  }
  return Ok([minus1])
}

export const main = (): void => {
  const r = make(true)
  if (r.ok) {
    const f = r.value[0]
    console.log(`${f(10)}`)
  }
  const s = make(false)
  if (s.ok) {
    const g = s.value[0]
    console.log(`${g(10)}`)
  }
}
