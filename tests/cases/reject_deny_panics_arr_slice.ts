// --deny-panics refuses an array `slice`: its bounds check is the `panic`
// call in `std/array.ts`, outside the no-panic scope, and no proof at the
// call removes it (NL2458).
export const main = (): void => {
  const xs: number[] = [3, 1, 2]
  console.log(`${xs.slice(1, 2).length}`)
}
