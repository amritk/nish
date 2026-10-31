// A body written past its declared length panics, also while part of what
// was written before is still pending behind a full carrier output.
import { DECLARED, halfWritten, Taken } from "./taken"
import { ZERO } from "../net_tls_record_common/bytes"

export const main = (): i32 => {
  const t = new Taken()
  halfWritten(t)
  const rest: u8[] = new Array<u8>(DECLARED / 2 + 1)
  t.h.write(t.req, rest, ZERO, toI32(rest.length))
  console.log("FAIL  the over-long write was taken")
  return 0
}
