// Panic sites: a compound store `xs[i] += f()` whose right side may resize the
// array checks the index again after the call, even where the guard proved
// the first check away (CG-10), so the store is an unproven `index` site
// beside the proven access.
const grow = (xs: i32[]): i32 => {
  xs.push(1)
  return 1
}

const bump = (xs: i32[]): void => {
  if (xs.length > 0) {
    xs[0] += grow(xs)
  }
}

export const main = (): number => {
  const xs: i32[] = [5]
  bump(xs)
  console.log(xs[0] + xs.length)
  return 0
}
