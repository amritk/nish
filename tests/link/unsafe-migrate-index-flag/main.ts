// The migration keeps what the program prints. Under --unchecked-indexing it
// reads and writes only in range, so `nish --fix` rewrites it and the result,
// compiled without the flag, prints the same lines. The link cases
// tests/link/unsafe-migrate-index-flag and unsafe-migrate-index-fixed run these
// files and their `.fixed.ts` and pin one expected.out.
import { histogram, weigh } from "./table"

export const main = (): i32 => {
  const data: i32[] = [3, 14, 15, 92, 65, 35, 89, 79, 32, 38]
  const buckets: i32[] = [0, 0, 0, 0, 0]
  histogram(data, buckets)
  const weights: f64[] = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]
  const names: string[] = ["zero", "one", "two", "three", "four"]
  console.log(weigh(buckets, weights, names))
  console.log(`${buckets[0]} ${buckets[1]} ${buckets[2]} ${buckets[3]} ${buckets[4]}`)
  return 0
}
