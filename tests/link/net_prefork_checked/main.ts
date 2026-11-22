// `tryPreforkWith` answers a `PreforkConfig` the supervisor cannot run with
// as an Err naming the first field at fault, where `preforkWith` panics with
// the same words (`tests/link/net_prefork_bad_config`). It answers before it
// reads the arguments or starts a worker, so each call here returns at once
// and the program goes on to the next.
import { PreforkConfig, tryPreforkWith } from "nish/net/prefork"
import { Suite } from "nish/testing"

/** The Err `tryPreforkWith` gives `config`, or "" when it started. */
const refusal = (config: PreforkConfig): string => {
  const ran = tryPreforkWith(process.argv, config)
  if (ran.isErr()) {
    return ran.error
  }
  return ""
}

export const main = (): i32 => {
  const t = new Suite("nish/net/prefork tryPreforkWith")
  const backoff = new PreforkConfig()
  backoff.backoffMs = 500
  backoff.backoffCapMs = 100
  t.eqStr("a backoff above its cap", refusal(backoff), "backoffMs not above 0 or above backoffCapMs")
  const workers = new PreforkConfig()
  workers.workers = -1
  t.eqStr("a negative worker count", refusal(workers), "workers below 0")
  const tick = new PreforkConfig()
  tick.tickMs = 0
  t.eqStr("a tick of 0", refusal(tick), "tickMs not above 0")
  const grace = new PreforkConfig()
  grace.graceMs = -1
  t.eqStr("a negative grace", refusal(grace), "quickExitMs or graceMs below 0")
  const service = new PreforkConfig()
  service.serviceWorker = -2
  t.eqStr("a service worker below -1", refusal(service), "serviceWorker below -1")
  const port = new PreforkConfig()
  port.listenPort = 65536
  t.eqStr("a port past 65535", refusal(port), "listenPort not -1 or 0..65535")
  return t.done()
}
