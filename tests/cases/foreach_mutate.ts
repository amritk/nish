// What a `forEach` callback does to the table it walks, beyond the cases
// `map_foreach` and `set_foreach` pin: a `set` on a key not yet visited
// overwrites its value, and the walk sees the new one; deleting the key the
// walk stands on does not stop it; deleting a key already visited and setting
// it again moves it to the end, where the walk visits it a second time; and
// `clear` inside a `Set` callback ends that walk. All agree with Node.

export const main = (): void => {
  const m = new Map<string, i32>()
  m.set("a", 1)
  m.set("b", 2)
  m.set("c", 3)
  m.forEach((v, k) => {
    if (k === "a") {
      m.set("c", 30)
    }
    console.log(`over ${k}=${v}`)
  })
  m.forEach((v, k) => {
    if (k === "b") {
      m.delete("b")
    }
    console.log(`cur ${k}=${v}`)
  })
  console.log(`${m.size} ${m.has("b")}`)
  m.forEach((v, k) => {
    if (k === "c") {
      m.delete("a")
      m.set("a", 5)
    }
    console.log(`again ${k}=${v}`)
  })
  m.forEach((v, k) => console.log(`order ${k}=${v}`))

  const s = new Set<i32>()
  s.add(1)
  s.add(2)
  s.add(3)
  s.forEach((x) => {
    console.log(`clear ${x}`)
    s.clear()
  })
  console.log(`${s.size}`)
}
