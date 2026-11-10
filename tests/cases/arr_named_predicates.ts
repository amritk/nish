// `some`, `every` and `findIndex` given a named function rather than an arrow:
// each call gets an instance of its own `std/array` loop that calls `isEven`
// or `isAbove` directly.

const isEven = (x: number): boolean => x % 2 === 0
const isAbove = (x: number, i: number): boolean => x > i * 2

export const main = (): void => {
  const xs: number[] = [3, 5, 4, 9]
  console.log(`${xs.some(isEven)} ${xs.every(isEven)} ${xs.findIndex(isEven)}`)
  console.log(`${xs.some(isAbove)} ${xs.every(isAbove)} ${xs.findIndex(isAbove)}`)
}
