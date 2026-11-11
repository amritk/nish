// A maybe-null source is spread once narrowed: `s` is a `Base` inside the
// `if`, so its fields copy as they would from any other `Base`.
interface Base {
  x: i32
  y: i32
}

class Holder {
  base: Base | null = null
}

export const main = (): void => {
  const h = new Holder()
  h.base = { x: 4, y: 5 }
  const s = h.base
  if (s !== null) {
    const p: Base = { ...s, y: 6 }
    console.log(`${p.x} ${p.y}`)
  }
}
