// The façade's WebSocket echo server for the Autobahn TestSuite's
// fuzzingclient (`.github/workflows/interop.yml`, job `autobahn`, agent
// `nish-facade`): `net_http_server_ws`'s `Rig` on 127.0.0.1:9002, every
// request on `/ws` upgraded through `HttpServer.acceptWebSocket` and every
// message echoed whole, in fragments of `RIG_FRAGMENT` bytes. Its own `bye`
// close is off, and a message may be 16 MiB, Autobahn's largest (cases 9.*).
//
//   autobahn
//
// prints `ws 9002` once it listens, then serves until SIGTERM or SIGINT;
// exits 0.
import { WS_SLOTS, wsConfig } from "../net_interop_server/ws"
import { Rig, rigLimits } from "./rig"

/** The port the fuzzingclient's `nish-facade` agent connects to. */
const PORT: i32 = 9002
/** `watch`'s name for the signal descriptor. */
const SIGNAL: i32 = 0

export const main = (): i32 => {
  // The interop port's limits, so both Autobahn agents take the same messages.
  const rig = new Rig(rigLimits(WS_SLOTS, 30000), WS_SLOTS, wsConfig(), PORT)
  rig.bye = false
  const fd: i32 = signalFd()
  if (fd >= 0) {
    rig.h.watch(fd, SIGNAL)
  }
  console.log(`ws ${rig.port}`)
  while (!rig.h.fired(SIGNAL)) {
    rig.step(20)
  }
  return 0
}
