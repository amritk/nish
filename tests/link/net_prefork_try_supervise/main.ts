// `tryPreforkSupervise` answers a `PreforkConfig` the supervisor cannot run
// with as an Err naming the first field at fault, where `preforkSupervise`
// panics with the same words. The worker count comes from `workers` here, so
// the program runs without NISH_WORKERS set. `tryPreforkWorkers` runs the default config,
// which it never refuses: in a worker (the worker flag last in its
// arguments) it answers that worker's index at once. Each call here returns
// before it starts a worker, so the program goes on to the next.
import { PREFORK_WORKER_FLAG, PreforkConfig, tryPreforkSupervise, tryPreforkWorkers } from "nish/net/prefork"
import { Suite } from "nish/testing"

/** Whether `tryPreforkSupervise` handed over a channel wake; none here. */
class Wakes {
  woke: boolean = false
}

const woke = (state: Wakes, _index: i32, _fd: i32, _events: i32): void => {
  state.woke = true
}

/** The Err `tryPreforkSupervise` gives `config`, or "" when it started. */
const refusal = (config: PreforkConfig, wakes: Wakes): string => {
  const ran = tryPreforkSupervise(process.argv, config, wakes, woke)
  if (ran.isErr()) {
    return ran.error
  }
  return ""
}

export const main = (): i32 => {
  const t = new Suite("nish/net/prefork tryPreforkSupervise")
  const wakes = new Wakes()
  const tick = new PreforkConfig()
  tick.tickMs = 0
  t.eqStr("a tick of 0", refusal(tick, wakes), "tickMs not above 0")
  const udp = new PreforkConfig()
  udp.listenUdp = true
  t.eqStr("UDP without a port", refusal(udp, wakes), "listenUdp without listenPort")
  const negative = new PreforkConfig()
  negative.workers = -1
  t.eqStr("workers below 0", refusal(negative, wakes), "workers below 0")
  const backoff = new PreforkConfig()
  backoff.backoffCapMs = 99
  t.eqStr("a backoff cap below the backoff", refusal(backoff, wakes), "backoffMs not above 0 or above backoffCapMs")
  const port = new PreforkConfig()
  port.listenPort = 65536
  t.eqStr("a port above 65535", refusal(port, wakes), "listenPort not -1 or 0..65535")
  const flags = new PreforkConfig()
  flags.listenFlags = 1
  t.eqStr("listen flags not 0 or 2", refusal(flags, wakes), "listenFlags not 0 or 2")
  // Past `preforkInvalid`: refusals that need the worker count, still
  // answered before any worker starts.
  const service = new PreforkConfig()
  service.workers = 2
  service.serviceWorker = 2
  t.eqStr(
    "a service worker not below the count",
    refusal(service, wakes),
    "serviceWorker not below 2 workers, or above 64 workers"
  )
  const crowd = new PreforkConfig()
  crowd.workers = 256
  crowd.listenPort = 0
  crowd.listenUdp = true
  t.eqStr("UDP with more than 255 workers", refusal(crowd, wakes), "listenUdp with 256 workers, above 255")
  t.ok("no channel woke the program", !wakes.woke)
  const worker = tryPreforkWorkers(["prefork", `${PREFORK_WORKER_FLAG}3`])
  t.ok("tryPreforkWorkers answers a worker", worker.ok)
  t.eqI32("with the worker's index", worker.ok ? worker.value : -1, 3)
  return t.done()
}
