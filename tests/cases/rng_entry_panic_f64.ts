// The f64-mode twin of rng_entry_panic, which is the program the unmodified
// Node runner compares: natively the last `i++` leaves `integer<0, 255>` and
// panics, and under Node the loop finishes and prints 32640. The divergence
// is declared in that runner's `KNOWN` and in known-failures.txt.
export const main = (): i32 => {
  let sum: i32 = 0
  for (let i: integer<0, 255> = 0; i < 256; i++) {
    sum = sum + i
  }
  console.log(`${sum}`)
  return 0
}
