// The entry tests/run.js's `host-import` section reads with --emit-ts and then
// type-checks with the page's host module. The reading spells `HostHandle`,
// starts one at `0` and hands it to a host function. tsc takes that only if
// the reading's `HostHandle` is the type runtime/nish.d.ts gives the page's.
// The section's probe imports `Canvas` and `Socket` to check what tsc refuses.
import { hSame } from "./host"

export type Canvas = HostHandle<"canvas">
export type Socket = HostHandle<"socket">

export const main = (): number => {
  let c: Canvas = 0
  c = hSame(c)
  console.log(c === 0 ? "none" : "some")
  return 0
}
