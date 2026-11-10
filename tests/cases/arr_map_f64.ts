// The array methods under `--number-mode f64`, where `number` is a double:
// the index a two-parameter callback gets and the index `findIndex` answers are
// doubles too, and a fractional `slice` bound is truncated toward zero and a
// NaN one is 0, natively and under Node alike.

const show = (xs: readonly number[]): string => xs.map((x) => `${x}`).join(",")

export const main = (): i32 => {
  const xs: number[] = [1.5, -2, 0.25, 8]
  console.log(show(xs.map((x, i) => x * 2 + i)))
  console.log(show(xs.filter((x) => x > 0)))
  console.log(`${xs.some((x) => x < 0)} ${xs.every((x) => x !== 0)} ${xs.findIndex((x) => x === 0.25)}`)
  console.log(show(xs.slice(1, 3)))
  const zero = 0
  console.log(`${show(xs.slice(0.9, 2.5))} ${show(xs.slice(zero / zero, 1.9))}`)
  return 0
}
