// A class-A program: an interface, classes with methods, and for...of over an
// array of objects. Nothing in it reads differently under Node, so
// `--emit-ts` writes it back byte for byte. The points are a class rather than
// a record: a record is copied into the array natively, and shared in
// TypeScript, which is the records row's to rewrite.

interface Named {
  name: string
}

class Point {
  x: number
  y: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

class Path {
  points: Point[]

  constructor() {
    this.points = []
  }

  add(x: number, y: number): void {
    this.points.push(new Point(x, y))
  }

  // The Manhattan length: every step is axis-aligned, so no square root.
  length(): number {
    let total = 0
    let i = 1
    while (i < this.points.length) {
      const a = this.points[i - 1]
      const b = this.points[i]
      total = total + Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
      i = i + 1
    }
    return total
  }
}

const label = (n: Named): string => `path ${n.name}`

export const main = (): number => {
  const named: Named = { name: "zigzag" }
  console.log(label(named))
  const path = new Path()
  path.add(0, 0)
  path.add(3, 0)
  path.add(3, 4)
  path.add(-1, 4)
  for (const p of path.points) {
    console.log(`(${p.x}, ${p.y})`)
  }
  console.log(`length ${path.length()}`)
  return 0
}
