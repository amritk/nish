// `http1ConfigChecked` is the twin of the cap check `Http1Connection`'s
// constructor panics on: the default caps pass and come back as they were,
// and a cap outside its range, or a `maxTarget` and `maxHeaderBytes` whose
// head would outgrow the parser's buffers, is an `Err` with the message the
// constructor would panic with, and nothing panics.
import { Http1Config, http1ConfigChecked } from "nish/net/http1-server"
import { Suite } from "nish/testing"

/** The message `http1ConfigChecked` refuses `config` with, or "ok". */
const verdict = (config: Http1Config): string => {
  const checked = http1ConfigChecked(config)
  if (checked.isErr()) {
    return checked.error
  }
  return checked.value === config ? "ok" : "a different config"
}

export const main = (): i32 => {
  const t = new Suite("http1-config-checked")
  t.eqStr("the default caps pass", verdict(new Http1Config()), "ok")
  const linger = new Http1Config()
  linger.lingerTimeout = 0
  t.eqStr("a linger timeout of 0 is refused", verdict(linger), "Http1Config.lingerTimeout: 0 is outside 1 to 1073741824")
  const header = new Http1Config()
  header.maxHeaderBytes = 63
  t.eqStr("a header cap below 64 is refused", verdict(header), "Http1Config.maxHeaderBytes: 63 is outside 64 to 1073741824")
  const head = new Http1Config()
  head.maxTarget = 1073741717
  head.maxHeaderBytes = 64
  t.eqStr(
    "a head past the parser's buffers is refused",
    verdict(head),
    "Http1Config.maxTarget + maxHeaderBytes: 1073741781 is outside 1 to 1073741780"
  )
  const first = new Http1Config()
  first.maxHeaders = 0
  first.outputSize = 1
  t.eqStr("the first cap outside is the one named", verdict(first), "Http1Config.maxHeaders: 0 is outside 1 to 1073741824")
  return t.done()
}
