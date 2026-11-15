// `xs.forEach(f)` compiles to `std/array`'s `forEach` or `forEachIndexed`,
// chosen by how many parameters `f` is written with, and each callback is an
// instantiation of its own that calls `f` directly. A named function, one- and
// two-parameter arrows, a readonly receiver, a callback that calls a function,
// and a callback that pushes, pops or stores into the array it walks all agree
// with Node's `Array.prototype.forEach`: the walk stops at the length the array
// had when it began, or sooner when the array shrinks.

const show = (x: i32): void => {
  console.log(`v ${x}`)
}

const twice = (x: i32): i32 => x * 2

const total = (xs: readonly i32[]): i32 => {
  let sum = 0
  for (const x of xs) {
    sum += x
  }
  return sum
}

export const main = (): void => {
  const xs: i32[] = [1, 2, 3]
  xs.forEach((x) => console.log(x))
  xs.forEach((x, i) => console.log(`${i}:${x}`))
  xs.forEach(show)
  const ys: i32[] = []
  xs.forEach((x) => ys.push(twice(x)))
  console.log(`${ys.length} ${total(ys)}`)
  const ro: readonly i32[] = xs
  ro.forEach((x) => console.log(x + 100))
  xs.forEach((x) => {
    if (x === 1) {
      xs.push(9)
    }
    console.log(`push ${x}`)
  })
  console.log(`${xs.length}`)
  xs.forEach((x, i) => {
    if (i + 1 < xs.length) {
      xs[i + 1] = x * 10
    }
    console.log(`store ${x}`)
  })
  xs.forEach((x) => {
    if (x === 1) {
      xs.pop()
      xs.pop()
    }
    console.log(`pop ${x}`)
  })
  const empty: i32[] = []
  empty.forEach(show)
  console.log(`${xs.length}`)
}
