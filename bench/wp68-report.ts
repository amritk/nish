// What every WP68 bench (bench/wp68-*.ts) prints: each side's minimum over the
// rounds in µs, its ratio to the first side, and whether the checksums agree.
// The first side is the baseline and the second its byte-identical twin, so
// the second ratio is the run's noise band (docs/wp68-shared-libraries.md §4).

/**
 * The smaller of `best` and `t`, where a negative `best` means none yet.
 *
 * @param best the least time so far, or -1
 * @param t this round's time
 * @returns the new least time
 */
export const least = (best: i64, t: i64): i64 => (best < 0 || t < best ? t : best)

/**
 * Prints one line per side and an agreement line.
 *
 * @param names each side's name, the baseline first and its twin second
 * @param best each side's least time in ns
 * @param sums each side's checksum
 * @returns 0 when every checksum equals the first, 1 otherwise
 */
export const report = (names: string[], best: i64[], sums: i64[]): i32 => {
  let agree = true
  for (let side = 0; side < names.length && side < best.length && side < sums.length; side++) {
    const us: f64 = toF64(best[side]) / 1000.0
    const ratio: f64 = toF64(best[side]) / toF64(best[0])
    console.log(`${names[side]}: ${us} us, ${ratio}x of ${names[0]}, checksum ${sums[side]}`)
    if (sums[side] !== sums[0]) {
      agree = false
    }
  }
  console.log(agree ? "checksums agree" : "checksums DIFFER")
  return agree ? 0 : 1
}
