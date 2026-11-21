// `Router.use` with a step the table never handed out is a programming
// error: the bit it names would bind nothing a program can run, so it
// panics while the table is built, before any request.
import { Router, RouterLimits } from "nish/net/router"

export const main = (): i32 => {
  const router = new Router(new RouterLimits())
  const home: i32 = router.add("GET", "/")
  const id: i32 = router.step()
  router.use(home, id)
  console.log(`step ${id} bound`)
  router.use(home, id + 1)
  console.log("unreachable")
  return 0
}
