// Starting a response twice panics: the request is not one taken and unanswered.
import { Taken } from "../net_http_server/taken"

export const main = (): i32 => {
  const t = new Taken("/")
  t.h.empty(t.req, 204)
  t.h.empty(t.req, 204)
  console.log("FAIL  the call returned")
  return 0
}
