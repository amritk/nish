/**
 * A class-A program built on object spread. Each spread is lowered to field
 * copies natively and kept as written under Node, where the TypeScript reading
 * is the same: the spread's fields first, in its type's order, then each field
 * the literal writes, which wins.
 */

interface Style {
  color: string
  width: number
  dashed: boolean
}

class Pen {
  color: string
  width: number
  dashed: boolean
  constructor(color: string) {
    this.color = color
    this.width = 1
    this.dashed = false
  }
}

const widened = (s: Style, width: number): Style => ({ ...s, width })

const show = (s: Style): string => `${s.color} ${s.width} ${s.dashed}`

export const main = (): number => {
  const base: Style = { color: "red", width: 2, dashed: false }
  const dashed: Style = { ...base, dashed: true }
  const fromPen: Style = { ...new Pen("blue") }
  console.log(show(base))
  console.log(show(dashed))
  console.log(show(widened(dashed, 4)))
  console.log(show(fromPen))
  return 0
}
