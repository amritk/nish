// A guard passed as a value is judged in each instance (docs/LANGUAGE.md,
// "Panic sites"). `checkWindow` is passed into `apply` and called through
// `check`; the instance `apply<checkWindow>` calls the guard itself, so its
// call is a `window` site, judged as a call by name is: the window is the
// whole buffer, and the site is listed as proven (`expected.panics`).
import { checkWindow } from "./sink"

const apply = (check: (what: string, buf: readonly u8[], off: i32, len: i32) => void, buf: u8[]): i32 => {
  check("apply", buf, 0, toI32(buf.length))
  return 0
}

export const main = (): i32 => {
  const buf: u8[] = [1, 2, 3, 4]
  console.log(`${apply(checkWindow, buf)}`)
  return 0
}
