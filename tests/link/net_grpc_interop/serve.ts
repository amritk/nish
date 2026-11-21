// The server the interop job's `grpc` job calls (`.github/workflows/interop.yml`):
// S3's `GrpcRig` (`../net_grpc/rig`), signed, on loopback, with a short
// `maxTimeout` so a held call's deadline passes inside one grpcurl run.
import { Secret, secret, wipe } from "nish:secret"
import { leafPrivate } from "../net_tls_common/server"
import { GrpcRig } from "../net_grpc/rig"

/** `GrpcLimits.maxTimeout` in `serve`: the deadline of every call, whatever its `grpc-timeout` asks for more. */
export const CAP_MS: i32 = 1000

/** Connections per listener. */
const SLOTS: i32 = 64

/** The longest one turn of the loop blocks, in ms: how late past its deadline a held call can be answered. */
const TURN_MS: i32 = 20

/** `watch`'s name for the signal descriptor. */
const SIGNAL: i32 = 0

/**
 * Answers `/Slow`'s held calls once every one is past its deadline, which
 * `reply` then turns into DEADLINE_EXCEEDED; how many it answered.
 */
export const release = (rig: GrpcRig): i32 => {
  if (rig.held.length === 0) {
    return 0
  }
  for (const r of rig.held) {
    if (!rig.grpc.expired(r)) {
      return 0
    }
  }
  return rig.answerHeld()
}

/** `serve`: prints `ports tls <port> h2c <port>`, then answers calls until SIGTERM or SIGINT; exits 0. */
export const serve = (): i32 => {
  const key: Secret<u8[]> = secret(leafPrivate())
  const rig = new GrpcRig(true, SLOTS, CAP_MS)
  const fd: i32 = signalFd()
  if (fd >= 0) {
    rig.h.watch(fd, SIGNAL)
  }
  console.log(`ports tls ${rig.port} h2c ${rig.h2cPort}`)
  while (!rig.h.fired(SIGNAL)) {
    rig.step(TURN_MS, key)
    release(rig)
  }
  wipe(key)
  return 0
}
