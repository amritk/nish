// A rest parameter gathers the trailing arguments into one exact-size array,
// on the caller's stack when the callee keeps no reference to it.
function total(...xs: number[]): number {
  let sum = 0
  for (const x of xs) {
    sum = sum + x
  }
  return sum
}

function joinAll(sep: string, ...parts: string[]): string {
  return parts.join(sep)
}

function count(first: boolean, ...rest: f64[]): number {
  return first ? rest.length + 1 : rest.length
}

interface Point {
  x: number
  y: number
}

function sumX(...ps: Point[]): number {
  let sum = 0
  for (const p of ps) {
    sum = sum + p.x
  }
  return sum
}

export function main(): void {
  console.log(total())
  console.log(total(5))
  console.log(total(1, 2, 3, 4))
  console.log(joinAll(", "))
  console.log(joinAll("-", "a", "b", "c"))
  console.log(count(true))
  console.log(count(false, 1.5, 2.5))
  console.log(sumX({ x: 1, y: 2 }, { x: 3, y: 4 }))
  const q: Point = { x: 10, y: 0 }
  console.log(sumX(q, q))
  let acc = 0
  for (let i = 0; i < 4; i = i + 1) {
    acc = acc + total(i, i * 2)
  }
  console.log(acc)
}
