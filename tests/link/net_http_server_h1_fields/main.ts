// More HTTP/1.1 header fields than `limits.maxFields` panics: each request
// holds that many spans.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { tcpListen } from "nish:net"

export const main = (): i32 => {
  const limits = new HttpServerLimits()
  limits.maxFields = 1
  bare(limits).listenHttp1(tcpListen("127.0.0.1", 0, 8), new Http1Config(), 4)
  console.log("FAIL  the call returned")
  return 0
}
