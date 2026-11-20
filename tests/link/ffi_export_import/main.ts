// WP66: a program imports a module's `declare function`s and the out class
// they fill, and calls the C library through them.
import { TallyOut, tally_add, tally_free, tally_get, tally_new } from "./tally"

export const main = (): i32 => {
  const t = tally_new(40)
  if (t === null) {
    return 1
  }
  tally_add(t, 2)
  const out = new TallyOut()
  const status = tally_get(t, out)
  tally_free(t)
  console.log(`${status} ${out.value}`)
  return 0
}
