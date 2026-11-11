// A spread copies a field that holds an object as the reference it is, and an
// entry after it can set that field to a fresh nested literal instead.
interface Inner {
  v: i32
}

interface Outer {
  id: i32
  inner: Inner
}

export const main = (): void => {
  const a: Outer = { id: 1, inner: { v: 2 } }
  const shared: Outer = { ...a, id: 2 }
  const fresh: Outer = { ...a, inner: { v: 9 } }
  shared.inner.v = 5
  console.log(`${a.inner.v} ${shared.id} ${shared.inner.v} ${fresh.id} ${fresh.inner.v}`)
}
