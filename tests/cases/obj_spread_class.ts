// A class instance spreads into a type that declares each of its fields: Node
// copies the instance's own fields and none of its methods, and so does the
// native copy, field by field. The copy is detached: a write to the instance
// after the spread leaves the literal as it was.
interface Pair {
  left: i32
  right: i32
  label: string
}

class Cell {
  left: i32 = 1
  right: i32 = 2
  sum(): i32 {
    return this.left + this.right
  }
}

export const main = (): void => {
  const c = new Cell()
  c.right = 7
  const p: Pair = { ...c, label: "cell" }
  console.log(`${p.left} ${p.right} ${p.label} ${c.sum()}`)
  c.left = 40
  console.log(`${p.left} ${p.right} ${c.left} ${c.right}`)
}
