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

  // The route as one line: the points joined by arrows.
  route(): string {
    let line = ""
    let first = true
    for (const p of this.points) {
      line = first ? `(${p.x}, ${p.y})` : `${line} -> (${p.x}, ${p.y})`
      first = false
    }
    return line
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
  console.log(`route ${path.route()}`)
  return 0
}
