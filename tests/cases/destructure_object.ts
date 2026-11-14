// `const { x, y: py } = p` binds each name to one field load from `p`, read
// through the pointer the receiver holds: no copy of the struct is made.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

interface Size {
  w: number
  h: number
}

class Box implements Size {
  w: number
  h: number
  label: string
  constructor(w: number, h: number, label: string) {
    this.w = w
    this.h = h
    this.label = label
  }
}

const area = (s: Size): number => {
  const { w, h } = s
  return w * h
}

export const main = (): void => {
  const p = new Point(3, 4)
  const { x, y: py } = p
  console.log(x + py)
  let { label, w } = new Box(2, 5, "box")
  w = w + 1
  console.log(`${label} ${w}`)
  console.log(area(new Box(6, 7, "b")))
}
