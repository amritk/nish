// WP51 stage 2: a nullable reference is an i32 tag, so a class field of
// type `F | null` is laid out as an i32 and accessed with `align 4`, as are
// the elements of an `(F | null)[]`.
type F = (x: i32) => i32

const plus1 = (x: i32): i32 => x + 1

class C {
  n: i32 = 1
  h: F | null = null
}

export const main = (): void => {
  const c = new C()
  c.h = plus1
  const h = c.h
  if (h !== null) {
    console.log(`${h(c.n)}`)
  }
  const a = new Array<F | null>(2)
  a[1] = plus1
  const g = a[1]
  if (g !== null) {
    console.log(`${g(41)}`)
  }
}
