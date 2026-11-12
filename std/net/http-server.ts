/**
 * `nish/net/http-server` — one handler for HTTP/1.1, HTTP/2 (over TLS and
 * cleartext) and HTTP/3, with Alt-Svc advertising the HTTP/3 port.
 *
 * Work in progress: the limits and their checks.
 */

/** The caps an `HttpServer` holds itself to; every listener's carrier is checked against them. */
export class HttpServerLimits {
  /** The most requests held at once, across every connection and version. 1 to 65536. */
  requests: i32 = 1024
  /** The largest request body, in bytes; past it a request is answered 413. 0 to 2^30. */
  maxBody: i32 = 1048576
  /** The largest request head (method, target and fields), in bytes. 256 to 2^20. */
  maxHead: i32 = 32768
  /** The most fields a request may carry. 1 to 1024. */
  maxFields: i32 = 100
  /** The most fields a response may carry, Alt-Svc and content-length included. 2 to 256. */
  maxResponseFields: i32 = 32
  /** Milliseconds from a request's head to the end of its body. */
  bodyTimeout: i32 = 30000
  /** Milliseconds an HTTP/2 connection with no open stream is kept. */
  idleTimeout: i32 = 60000
  /** Milliseconds a cleartext HTTP/2 connection has to send its preface. */
  prefaceTimeout: i32 = 10000
  /** Seconds a client may remember the Alt-Svc advertisement; 0 sends `alt-svc: clear`. */
  altSvcMaxAge: i32 = 86400
  /** The port Alt-Svc names; 0 names the HTTP/3 socket's own. */
  altSvcPort: i32 = 0
  /** The most readiness events one `wait` takes. */
  maxEvents: i32 = 256
  /** Bytes in the JSON scratch buffer. At least 256. */
  jsonBytes: i32 = 65536
}
