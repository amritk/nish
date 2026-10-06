// The soak's relay: `examples/relay/relay.ts`'s `Relay` alone in a process,
// so that its arena and its resident memory are its own. It serves until
// `total` sessions have been closed by their clients, and writes a line to
// `report` every `every` of them and at the end: the arena's bump position and its offset
// in the current chunk (`Arena.mark`, `Arena.used`), and the resident set
// from /proc/self/statm.
import { appendFileSync, readFileSyncOrNull, writeFileSync } from "nish:fs";
import { netLocalPort, udpBind } from "nish:net";
import { monotonicNanos, spawnSyncTo } from "nish:process";
import { Secret, secret, wipe } from "nish:secret";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { Relay, RelayConfig } from "../../../examples/relay/relay";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { RIG_WALL, rigRelay } from "../net_relay/rig";

/** The soak relay's caps: a pool of 64 sessions and 8 spare slots, every one from the loopback. */
export const SOAK_SESSIONS: i32 = 64;

/**
 * The resident set in bytes, from the second field of this process's
 * /proc/<pid>/statm (pages of 4 KiB), or -1. Read through `cat`, run by a
 * shell whose parent is this process: procfs reports a size of 0, which a
 * read sized by `stat` takes at its word.
 */
export const residentBytes = (scratch: string): i64 => {
  if (spawnSyncTo(["sh", "-c", "cat /proc/$PPID/statm"], scratch, "") !== 0) {
    return -1;
  }
  const text: string | null = readFileSyncOrNull(scratch);
  if (text === null) {
    return -1;
  }
  let field: i32 = 0;
  let value: i64 = 0;
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    const c: i32 = toI32(text.charCodeAt(k));
    if (c === 32) {
      field++;
      if (field > 1) {
        return value * 4096;
      }
      value = 0;
    } else if (field === 1 && c >= 48 && c <= 57) {
      value = value * 10 + toI64(c - 48);
    }
  }
  return field === 1 ? value * 4096 : n64(-1);
};

/** One checkpoint line. */
const checkpoint = (report: string, closed: i32, relay: Relay): void => {
  appendFileSync(report, `at ${closed} mark ${Arena.mark()} used ${Arena.used()} rss ${residentBytes(`${report}.statm`)} live ${relay.live}\n`);
};

/**
 * The relay on a loopback port of its own, which it writes to `portFile`,
 * until `total` sessions are closed or two minutes pass.
 */
export const serve = (portFile: string, report: string, total: i32, every: i32): i32 => {
  const fd: i32 = udpBind("127.0.0.1", n32(0), n32(2));
  const config = new RelayConfig();
  config.maxSessions = SOAK_SESSIONS;
  config.maxPerPeer = SOAK_SESSIONS;
  config.spareSlots = 8;
  // Verbose, as the relay's own default is: its log goes to /dev/null, and what a session's lines cost is measured.
  config.verbose = true;
  const entropy: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE);
  crypto.getRandomValues(entropy);
  const relay: Relay = rigRelay(config, fd, entropy);
  writeFileSync(report, "");
  writeFileSync(portFile, `${netLocalPort(fd)}\n`);
  const key: Secret<u8[]> = secret(leafPrivate());
  const start: i64 = monotonicNanos() / 1000000;
  let next: i32 = every;
  checkpoint(report, n32(0), relay);
  let closed: i32 = 0;
  while (closed < total) {
    const now: i64 = monotonicNanos() / 1000000;
    if (now - start > 600000) {
      break;
    }
    const wait: i32 = relay.timeout(now);
    relay.step(now, RIG_WALL + (now - start), key, wait < 0 || wait > 20 ? n32(20) : wait);
    closed = relay.clientClosed;
    while (closed >= next) {
      checkpoint(report, next, relay);
      next = next + every;
    }
  }
  if (closed >= total && total % every !== 0) {
    checkpoint(report, total, relay);
  }
  wipe(key);
  appendFileSync(report, `done ${closed} accepted ${relay.accepted} refused ${relay.refusedFull + relay.refusedPeer} up ${relay.forwardedUp} down ${relay.forwardedDown}\n`);
  return 0;
};
