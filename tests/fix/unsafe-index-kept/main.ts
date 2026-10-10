// #461: an access the build without the flag proves is not a site. `names[i]`
// holds strings, so it has no `nish:unsafe` form and keeps its check once the
// flag is gone, and that check leaves `i >= 0` behind it: with the guard,
// `xs[i]` is proven without the flag, so it is neither reported nor rewritten.
// `ys[j]` has no such check before it and is rewritten.
export const label = (names: string[], xs: i32[], ys: i32[], i: i32, j: i32): string => {
  const name = names[i]
  if (i < xs.length) {
    return `${name} ${xs[i]} ${ys[j]}`
  }
  return name
}
