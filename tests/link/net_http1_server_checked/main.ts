// `http1ServerChecked` and `http1ConnectionChecked` are the twins of the
// `Http1Server` and `Http1Connection` constructors: a cap outside its range
// is an `Err` with the message the constructor's connection would panic
// with, and nothing panics. Each keeps a copy of the config it checked, so
// a cap set bad afterwards reaches none of its connections. A pool made by
// `new Http1Server` with a bad cap answers `tryConnection` with null where
// `connection` would panic. No socket is opened: the pool never reads its
// listener until `accept`.
import { Http1Config, Http1Server, http1ConnectionChecked, http1ServerChecked } from "nish/net/http1-server"
import { Suite } from "nish/testing"

/** The message `http1ServerChecked` refuses `config` with, or "ok". */
const serverVerdict = (config: Http1Config): string => {
  const made = http1ServerChecked(config, -1, 4)
  if (made.isErr()) {
    return made.error
  }
  return made.value.tryConnection(0) !== null ? "ok" : "no connection"
}

/** The message `http1ConnectionChecked` refuses `config` with, or "ok". */
const connectionVerdict = (config: Http1Config): string => {
  const made = http1ConnectionChecked(config)
  if (made.isErr()) {
    return made.error
  }
  return "ok"
}

export const main = (): i32 => {
  const t = new Suite("http1-server-checked")
  t.eqStr("a server under the default caps is made", serverVerdict(new Http1Config()), "ok")
  const linger = new Http1Config()
  linger.lingerTimeout = 0
  t.eqStr(
    "a server under a linger timeout of 0 is refused",
    serverVerdict(linger),
    "Http1Config.lingerTimeout: 0 is outside 1 to 1073741824"
  )
  t.eqStr("a connection under the default caps is made", connectionVerdict(new Http1Config()), "ok")
  const header = new Http1Config()
  header.maxHeaderBytes = 63
  t.eqStr(
    "a connection under a header cap below 64 is refused",
    connectionVerdict(header),
    "Http1Config.maxHeaderBytes: 63 is outside 64 to 1073741824"
  )
  const later = new Http1Config()
  const made = http1ServerChecked(later, -1, 4)
  later.maxHeaders = 0
  t.ok("a cap set bad after the check reaches no connection", made.ok && made.value.tryConnection(1) !== null)
  const unchecked = new Http1Server(linger, -1, 4)
  t.ok("an unchecked pool with a bad cap gives no connection", unchecked.tryConnection(0) === null)
  return t.done()
}
