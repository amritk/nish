// The `try*` twins answer a broken contract with an `Err` carrying the message
// the panicking method panics with, and leave the request answerable.
import { Taken } from "../net_handler_overlong/taken"

export const main = (): i32 => {
  const t = new Taken()
  const unbegun: Result<i32, string> = t.h.trySendJson(t.req, 200)
  console.log(unbegun.isErr() ? `unbegun: ${unbegun.error}` : "FAIL  trySendJson sent a value json() never began")
  const status: Result<i32, string> = t.h.tryEmpty(t.req, 99)
  console.log(status.isErr() ? `status: ${status.error}` : "FAIL  tryEmpty sent status 99")
  const sent: Result<i32, string> = t.h.tryEmpty(t.req, 204)
  console.log(sent.isErr() ? `FAIL  ${sent.error}` : `empty: ${sent.value}`)
  const again: Result<i32, string> = t.h.tryEmpty(t.req, 204)
  console.log(again.isErr() ? "again: refused" : `again: ${again.value}`)
  return 0
}
