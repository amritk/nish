// The deep pipeline of `main.ts` alone, for tests/run.js to run under a
// 512 KiB stack (`ulimit -s 512`): twenty-five thousand `OPTIONS *` read
// behind a held request, all answered once it is. A server that went one
// call deeper per pipelined request overflowed that stack inside the burst;
// the default 8 MiB hides it, which is why `main.ts` alone cannot catch it.
import { App, CAP, DEEP, deepPipeline } from "./server"

export const main = (): i32 => {
  const app = new App(toI32(60000), toI32(30000), toI32(64), CAP, toI32(786432))
  deepPipeline(app, DEEP)
  return app.failures === 0 ? 0 : 1
}
