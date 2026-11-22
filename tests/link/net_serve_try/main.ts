// The `Result` twins of `nish/net/serve`'s panicking accessors: `tryParam`,
// `tryParamNumber` and `tryParamMalformed` give `Err` for a parameter the
// route does not have, where `param` panics, and `tryBytes` gives `Err` for a
// window outside its buffer, where `bytes` panics, setting nothing.
import { HttpRequest } from "nish/net/handler"
import { Request, Response } from "nish/net/serve"

export const main = (): i32 => {
  // A head of "/u/42/a%zz", with the route's two parameters `42` and `a%zz`.
  const raw: HttpRequest = new HttpRequest(0)
  const head: string = "/u/42/a%zz"
  const bytes: u8[] = new Array<u8>(head.length)
  for (let k: i32 = 0; k < toI32(head.length); k++) {
    bytes[k] = toU8(head.charCodeAt(k))
  }
  raw.head = bytes
  raw.params = [3, 5, 6, 10]
  raw.paramCount = 2
  const req: Request = new Request(raw)

  const first: Result<string, string> = req.tryParam(0)
  console.log(first.isErr() ? `err ${first.error}` : `param 0 = ${first.value}`)
  const number: Result<i32, string> = req.tryParamNumber(0)
  console.log(number.isErr() ? `err ${number.error}` : `number 0 = ${number.value}`)
  const bad: Result<boolean, string> = req.tryParamMalformed(1)
  console.log(bad.isErr() ? `err ${bad.error}` : `malformed 1 = ${bad.value}`)
  const good: Result<boolean, string> = req.tryParamMalformed(0)
  console.log(good.isErr() ? `err ${good.error}` : `malformed 0 = ${good.value}`)

  const missing: Result<string, string> = req.tryParam(2)
  console.log(missing.isErr() ? `err ${missing.error}` : "param 2 found")
  const noNumber: Result<i32, string> = req.tryParamNumber(-1)
  console.log(noNumber.isErr() ? `err ${noNumber.error}` : "number -1 found")
  const noMalformed: Result<boolean, string> = req.tryParamMalformed(5)
  console.log(noMalformed.isErr() ? `err ${noMalformed.error}` : "malformed 5 found")

  const buf: u8[] = [104, 105, 33]
  const res: Response = new Response(200)
  const outside: Result<Response, string> = res.tryBytes("text/plain", buf, 2, 2)
  console.log(outside.isErr() ? `err ${outside.error}` : "outside set")
  console.log(`length after err = ${res.length}`)
  const negative: Result<Response, string> = res.tryBytes("text/plain", buf, -1, 1)
  console.log(negative.isErr() ? `err ${negative.error}` : "negative set")
  const inside: Result<Response, string> = res.tryBytes("text/plain", buf, 1, 2)
  console.log(inside.isErr() ? `err ${inside.error}` : `set ${res.length} bytes of ${res.type}: ${String.fromBytes(res.body, 0, res.length)}`)
  return 0
};
