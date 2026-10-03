// Panic sites: `pop` checks for an empty array before it shortens one, and
// nothing proves that check away yet, so every `pop` is a site.
const last = (xs: i32[]): i32 => xs.pop()

export const main = (): number => {
  const xs: i32[] = []
  xs.push(4)
  xs.push(5)
  console.log(last(xs))
  console.log(xs.length)
  return 0
}
