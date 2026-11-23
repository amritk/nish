// The `try*` calls a program held to no panics answers through give an `Err`
// with the message their panicking twin carries, for each contract a program
// can break: a route parameter or field index the request does not have, a
// watch id outside the range, a field the handler writes itself, a status
// outside 200 to 599, more body than the length said, a body window outside
// its buffer, less body, and an answer to a request one of those let go. Each
// refusal after the head abandons the request: the log shows its connection
// closed and every later answer for it refused.
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
  // A refusal after the head abandons the request: its connection closes
  // (`connections` falls from 1 to 0) and it goes back to the free list, so
  // every later answer for it is refused at state 0.
  show("write 1 of 3", t.h.tryWrite(req, body, ZERO, 1))
  open(t)
  closed("write 5 of 3", t, t.h.tryWrite(req, body, ZERO, 5))
  show("write after", t.h.tryWrite(req, body, ZERO, 1))
  show("end after", t.h.tryEnd(req))
  show("problem", t.h.tryProblem(req, 404, "Not Found", "answered already"))
  show("refuse", t.h.tryRefuse(req))

  // A window outside the buffer, mid-body, abandons it the same way.
  const v = new Taken()
  show("start", v.h.tryStart(v.req, 200, type, plain, 3))
  open(v)
  closed("write outside", v, v.h.tryWrite(v.req, body, 4, 2))
  show("end after", v.h.tryEnd(v.req))

  // So does a body short of the length at the end.
  const w = new Taken()
  show("start", w.h.tryStart(w.req, 200, type, plain, 3))
  show("write 1 of 3", w.h.tryWrite(w.req, body, ZERO, 1))
  open(w)
  closed("end at 1 of 3", w, w.h.tryEnd(w.req))
  show("empty after", w.h.tryEmpty(w.req, 204))

  // A field the handler writes itself: the carrier refuses the head, and the
  // request is abandoned with it.
  const u = new Taken()
  open(u)
  closed("start content-length", u, u.h.tryStart(u.req, 200, [ascii("content-length")], [ascii("3")], 3))
  show("empty after", u.h.tryEmpty(u.req, 204))
  return 0
}

/** Logs how many connections `t`'s handler holds: 1 while the client's is open. */
const open = (t: Taken): void => {
  console.log(`connections: ${t.h.connections()}`)
}

/** `show`s `result`, then how many connections `t`'s handler holds after it: 0 once it closed the client's. */
const closed = (what: string, t: Taken, result: Result<i32, string>): void => {
  show(what, result)
  console.log(`${what}: connections ${t.h.connections()}`)
}
