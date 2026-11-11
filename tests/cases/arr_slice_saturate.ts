// A float `slice` bound saturates as it converts to `i64`: -Infinity to the
// least `i64` and anything at or past 2^63 to the greatest, so the panic names
// the same range natively and under Node (checked in tests/run.js: exit 1).

export const main = (): void => {
  const xs: number[] = [3, 1, 2]
  const zero = 0
  const big = 4294967296 * 2147483648
  console.log(`${xs.slice(-1 / zero, big).length}`)
}
