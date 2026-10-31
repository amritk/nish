// A response ended short of its declared length panics, also while part of
// what was written is still pending behind a full carrier output.
import { halfWritten, Taken } from "../net_handler_overlong/taken"

export const main = (): i32 => {
  const t = new Taken()
  halfWritten(t)
  t.h.end(t.req)
  console.log("FAIL  the short response was ended")
  return 0
}
