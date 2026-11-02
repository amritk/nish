// A rest parameter of records takes no named record: the array would copy it,
// and the callee's write would not reach `p` as it does in TypeScript.
interface Cell {
  v: number
}
function bumpAll(...cs: Cell[]): void {
  for (const c of cs) {
    c.v = c.v + 100
  }
}
export function main(): void {
  const p: Cell = { v: 1 }
  bumpAll(p, { v: 2 })
  console.log(p.v)
}
