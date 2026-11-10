// `xs.map(f)` compiles to `std/array`'s `map` or `mapIndexed`, chosen by how
// many parameters `f` is written with, and each callback is an instantiation of
// its own that calls `f` directly. A named function, one- and two-parameter
// arrows, a captured `const`, a readonly receiver, a chain, string elements and
// interface records out all agree with Node's `Array.prototype.map`.

interface Point {
  x: number
  y: number
}

const double = (x: number): number => x * 2

const show = (xs: readonly number[]): string => xs.map((x) => `${x}`).join(",")

export const main = (): void => {
  const xs: number[] = [3, 1, 2, 5]
  const ro: readonly number[] = xs
  const k = 10
  console.log(show(xs.map(double)))
  console.log(show(xs.map((x, i) => x * k + i)))
  console.log(show(ro.map((x) => x - 1)))
  console.log(show(xs.map(double).map((x) => x + 1)))
  const words = ["a", "bb", "ccc"]
  console.log(words.map((w, i) => `${i}:${w}`).join(" "))
  const ps: Point[] = [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ]
  const swapped = ps.map((p): Point => ({ x: p.y, y: p.x }))
  console.log(`${swapped[0].x} ${swapped[0].y} ${swapped[1].x} ${swapped[1].y}`)
  const empty: number[] = []
  console.log(`${empty.map(double).length} ${xs.length}`)
}
