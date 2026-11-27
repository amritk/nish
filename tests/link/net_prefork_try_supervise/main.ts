// `tryPreforkSupervise` answers a `PreforkConfig` the supervisor cannot run
// with as an Err naming the first field at fault, where `preforkSupervise`
// panics with the same words. `tryPreforkWorkers` runs the default config,
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
  t.ok("no channel woke the program", !wakes.woke)
  const worker = tryPreforkWorkers(["prefork", `${PREFORK_WORKER_FLAG}3`])
  t.ok("tryPreforkWorkers answers a worker", worker.ok)
  t.eqI32("with the worker's index", worker.ok ? worker.value : -1, 3)
  return t.done()
}
