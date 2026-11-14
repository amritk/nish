// `m.forEach(f)` on a `Map` walks the table in insertion order, as `for...of`
// over it does, and calls `f` with each value, and its key when `f` takes two
// parameters. A key deleted and set again moves to the end; a key the callback
// deletes before the walk reaches it is not visited, and one it sets is.
// `clear` inside the callback ends the walk. All agree with Node.

const show = (v: i32): void => {
  console.log(`s ${v}`)
}

export const main = (): void => {
  const m = new Map<string, i32>()
  m.set("a", 1)
  m.set("b", 2)
  m.set("c", 3)
  m.delete("a")
  m.set("a", 4)
  m.forEach((v, k) => console.log(`${k}=${v}`))
  m.forEach((v) => console.log(`${v}`))
  m.forEach(show)
  m.forEach((v, k) => {
    if (k === "b") {
      m.delete("c")
      m.set("d", 9)
    }
    console.log(`${k}:${v}`)
  })
  const seen: string[] = []
  m.forEach((_v, k) => {
    seen.push(k)
    m.clear()
  })
  console.log(`${seen.length} ${seen[0]}`)
  console.log(`${m.size}`)
}
