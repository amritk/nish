// A constant table cannot reach a mutable `T[]` through a closure capture:
// the arrow captures a local holding the table, and the capture keeps its
// `readonly` type, so widening it to `i32[]` inside the arrow is refused.
const TAB: readonly i32[] = [1, 2, 3]

const run = (f: () => void): void => {
  f()
}

export const main = (): void => {
  const view = TAB
  run((): void => {
    const ys: i32[] = view
    ys[0] = 9
  })
  console.log(`${view[0]}`)
}
