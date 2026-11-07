// The entry tests/run.js's `host-import` section reads with --emit-ts and then
// type-checks with the page's host module: the reading spells `HostHandle`,
// starts one at `0` and hands it to a host function, which tsc takes only if
// the reading's `HostHandle` is the shape runtime/nish.d.ts gives the page's.
import { hSame } from "./host"

type Canvas = HostHandle<"canvas">

export const main = (): number => {
  let c: Canvas = 0
  c = hSame(c)
  console.log(c === 0 ? "none" : "some")
  return 0
}
