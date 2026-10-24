// `nish/term-pixels`: deleting kitty image id 0 panics; kitty reserves 0.
import { kittyDelete } from "nish/term-pixels"

export const main = (): i32 => {
  console.log(`${kittyDelete(1).length > 0 ? 1 : 0}`)
  console.log(kittyDelete(0))
  return 0
}
