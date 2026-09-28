// WP31 §7's loop-counter trap, and the warning §8 gives it: the counter has
// to reach 256 to leave the loop, and 256 is outside `integer<0, 255>`, so
// every `i++` enters the range with a check -- reported, since it is inside
// the loop -- and the last one fails it: the program prints its first line
// and exits 1 before the second. `perf_rng_quiet` is the rewrite the warning
// names, with the range on the value that is used.
export const main = (): number => {
  let sum = 0
  console.log("counting")
  for (let i: integer<0, 255> = 0; i < 256; i++) {
    sum = sum + i
  }
  console.log(`${sum}`)
  return 0
}
