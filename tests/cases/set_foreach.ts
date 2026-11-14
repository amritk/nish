// `s.forEach(f)` on a `Set` walks it in insertion order and calls `f` with
// each element. An element the callback adds is visited and one it deletes
// before the walk reaches it is not, as Node does. A nested walk goes through
// a top-level function, since an arrow inside another arrow reads only its
// own parameters.

const pairs = (s: Set<i32>, x: i32): void => {
  s.forEach((y) => console.log(`${x}*${y}`))
}

export const main = (): void => {
  const s = new Set<i32>()
  s.add(5)
  s.add(6)
  s.forEach((x) => console.log(`e ${x}`))
  s.forEach((x) => pairs(s, x))
  const out: i32[] = []
  s.forEach((x) => out.push(x * 10))
  console.log(`${out.length} ${out[0]} ${out[1]}`)
  s.add(7)
  s.forEach((x) => {
    if (x === 5) {
      s.delete(6)
      s.add(8)
    }
    console.log(`walk ${x}`)
  })
  console.log(`${s.size}`)
}
