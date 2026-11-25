// A route into a window contract that no call names holds no proof
// (docs/LANGUAGE.md, "Panic sites"). `checkWindow` is passed as a value and
// called through it: the instance `apply<checkWindow>` holds the guard's check
// as a `window` site, but nothing judges a window through a value, so the site
// stays unproven although the window it passes is the whole buffer, and
// `--deny-panics` (`args`) refuses it. Calling `checkWindow` by name proves it.
import { checkWindow } from "./sink"

const apply = (check: (what: string, buf: readonly u8[], off: i32, len: i32) => void, buf: u8[]): i32 => {
  check("apply", buf, 0, toI32(buf.length))
  return 0
}

export const main = (): i32 => {
  const buf: u8[] = [1, 2, 3, 4]
  return apply(checkWindow, buf)
}
