// WP31 §7: a type argument keeps its range. `identity(r)` infers
// `T := integer<0, 9>` and gets a define of its own, `@identity$rng.p0.p9`,
// beside the `i32` one, and `Box<integer<-128, 127>>` is
// `%struct.Box$rng.m128.p127`. An argument that is not yet in the range enters
// it at the constructor call, checked; a literal inside it does not.
const identity = <T>(x: T): T => x

class Box<T> {
  value: T
  constructor(value: T) {
    this.value = value
  }
}

export const main = (): number => {
  const r: integer<0, 9> = 7
  const same = identity(r)
  const plain = identity(8)
  const low = new Box<integer<-128, 127>>(-100)
  const n = 20
  const high = new Box<integer<-128, 127>>(n * 5)
  console.log(`${same} ${plain} ${low.value} ${high.value}`)
  return 0
}
