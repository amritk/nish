// `sendJson` with no value begun by `json()` is the program's bug: it panics
// rather than send what the writer last held.
import { Taken } from "../net_handler_overlong/taken"

export const main = (): i32 => {
  const t = new Taken()
  t.h.sendJson(t.req, 200)
  console.log("FAIL  sendJson sent a value json() never began")
  return 0
}
