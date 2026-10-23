// `dst.set(src, at)` on an array of numbers copies through the core's
// `arraySet`, since a `u8[]` is a plain `Array` under Node. A `Map`'s `set` is
// its own method and stays as written.
import { arraySet } from "nish/runtime"
import type { u8 } from "nish/runtime"

export const main = (): number => {
  const dst: u8[] = [0, 0, 0, 0]
  const src: u8[] = [7, 8]
  arraySet(dst, src, 1)
  arraySet(dst, src)
  arraySet(dst, dst, 0)
  console.log(`${dst[0]} ${dst[1]} ${dst[2]} ${dst[3]}`)
  const counts = new Map<string, number>()
  counts.set("é", 2)
  console.log(`${counts.get("é") ?? 0}`)
  return 0
}
