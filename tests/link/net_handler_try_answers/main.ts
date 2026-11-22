// The `try*` calls a program held to no panics answers through give an `Err`
// with the message their panicking twin carries, for each contract a program
// can break: a route parameter or field index the request does not have, a
// watch id outside the range, a field the handler writes itself, a status
// outside 200 to 599, more body than the length said, less, and an answer to a
// request the short body let go.
import { HANDLER_MAX_WATCHED } from "nish/net/handler"
import { Taken } from "../net_handler_overlong/taken"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

const show = (what: string, result: Result<i32, string>): void => {
  console.log(result.isErr() ? `${what}: Err ${result.error}` : `${what}: Ok ${result.value}`)
}

export const main = (): i32 => {
  const t = new Taken()
  const req = t.req

  // The route `/` has no parameter 0.
  show("paramStart", req.tryParamStart(ZERO))
  show("paramEnd", req.tryParamEnd(ZERO))
  show("paramDecimal", req.tryParamDecimal(ZERO))

  // `Host` is the one field the client sent; 7 is no field index.
  const host: i32 = req.header("host")
  const start: Result<i32, string> = req.tryValueStart(host)
  const end: Result<i32, string> = req.tryValueEnd(host)
  if (start.isOk() && end.isOk()) {
    console.log(`host: ${String.fromBytes(req.head, start.value, end.value)}`)
  } else {
    console.log("FAIL  host has no value span")
  }
  show("valueStart 7", req.tryValueStart(7))
  show("valueEnd 7", req.tryValueEnd(7))

  const watched: Result<boolean, string> = t.h.tryWatch(ZERO, HANDLER_MAX_WATCHED)
  console.log(watched.isErr() ? `watch: Err ${watched.error}` : "FAIL  tryWatch took an id outside the range")

  const type: u8[][] = [ascii("content-type")]
  const plain: u8[][] = [ascii("text/plain")]
  show("start 99", t.h.tryStart(req, 99, type, plain, 3))
  show("start", t.h.tryStart(req, 200, type, plain, 3))
  const body: u8[] = ascii("hello")
  show("write 5 of 3", t.h.tryWrite(req, body, ZERO, 5))
  show("write 1 of 3", t.h.tryWrite(req, body, ZERO, 1))
  show("end at 1 of 3", t.h.tryEnd(req))
  show("problem", t.h.tryProblem(req, 404, "Not Found", "answered already"))
  show("refuse", t.h.tryRefuse(req))

  // A field the handler writes itself: the carrier refuses the head, and the
  // request is abandoned with it.
  const u = new Taken()
  show("start content-length", u.h.tryStart(u.req, 200, [ascii("content-length")], [ascii("3")], 3))
  show("empty after", u.h.tryEmpty(u.req, 204))
  return 0
}
