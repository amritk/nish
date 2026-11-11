// NL2738: a function reference as a `Map` value is refused until a `Map`
// value is a place the reference pass tracks.
type Op = (x: i32) => i32

export const main = (): void => {
  const m = new Map<string, Op>()
  console.log(`${m.size}`)
}
