// Panic sites: `pop` checks for an empty array before it shortens one, and
// nothing proves that check away yet, so every `pop` is a site.
const dropLast = (xs: i32[]): void => {
  xs.pop()
}

export const main = (): number => {
  const xs: i32[] = []
  xs.push(4)
  xs.push(5)
  dropLast(xs)
  console.log(xs.length)
  console.log(xs[0])
  return 0
}
