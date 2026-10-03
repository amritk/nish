// Panic sites: `pop` checks for an empty array before it shortens one, so
// every `pop` is a site; behind `xs.length > 0` the check is proven away, and
// the site is listed as proven.
const dropLast = (xs: i32[]): void => {
  xs.pop()
}

const dropIfAny = (xs: i32[]): void => {
  if (xs.length > 0) {
    xs.pop()
  }
}

export const main = (): number => {
  const xs: i32[] = []
  xs.push(4)
  xs.push(5)
  xs.push(6)
  dropLast(xs)
  dropIfAny(xs)
  console.log(xs.length)
  console.log(xs[0])
  return 0
}
