/**
 * The WebTransport relay: cs's `services/relay` (Rust, over `wtransport`
 * 0.7) written in Nish on `std/net`. Its whole job is to get game traffic off
 * TCP: a browser sends unreliable WebTransport datagrams over QUIC, and the
 * relay forwards each payload verbatim over real UDP to the game server
 * named in a signed grant, one upstream socket per session. It knows nothing
 * about the game. README.md beside this file says what it does, how it is
 * tested, and what is still open.
 *
 *     nish examples/relay/main.ts --link build/relay
 *     build/relay --port 4433 --secret "$(openssl rand -hex 32)" --cert-out /run/cs/relay.json
 *
 * The command line and the environment are main.rs's: `--port`
 * (`CS_RELAY_PORT`, 4433), `--bind` (`CS_RELAY_BIND`; dual-stack `::` with a
 * fall-back to `0.0.0.0` otherwise), `--path` (`CS_RELAY_PATH`, `/cs`),
 * `--secret` (`CS_RELAY_SECRET`, the development secret `cs-dev-secret`
 * otherwise), `--cert-out` (`CS_RELAY_CERT_OUT`), `--cert` and `--key`
 * (`CS_RELAY_TLS_CERT`, `CS_RELAY_TLS_KEY`), `--san`, repeatable
 * (`CS_RELAY_SAN`, comma-separated), and the switch `--offload`
 * (`CS_RELAY_OFFLOAD` of `1`, `true` or `yes`). `--help` prints them. A bad
 * option exits 2 with the reason on stderr, and so does the development
 * secret beside a `--san` that is a host name rather than an address: that
 * relay is reached by name, and a public secret is all that would stand
 * between anybody and a UDP reflector.
 *
 * SIGINT and SIGTERM stop it cleanly: every session is sent CLOSE SHUTDOWN
 * and its connection closed, then the process exits 0.
 */
// smoke: argv --help
import { writeFileSync } from "nish:fs"
import { udpBind } from "nish:net"
import { monotonicNanos, signalFd } from "nish:process"
import { write, writeError } from "nish:io"
import { Secret, secret, wipe } from "nish:secret"
import { httpFieldBytes } from "nish/net/http-fields"
import { QUIC_CONN_STATIC_KEY_SIZE } from "nish/net/quic"
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener"
import { GrantVerifier } from "./grant"
import {
  RelayIdentity,
  RelaySource,
  RelayWatch,
  SELF_SIGNED_DAYS,
  relayCertOutBody,
  relayLoadPem,
  relayMintIdentity,
  relayRenew,
  relaySourceFrom,
} from "./identity"
import { DEV_SECRET, RelayOptions, relayNamed, relayOptionsFromEnv, relayParseArgs } from "./options"
import { Relay, RelayConfig, relayQuicConfig } from "./relay"

/** How often the certificate files are looked at for a renewal, ms (main.rs's `CERT_POLL_INTERVAL`). */
const CERT_POLL_INTERVAL: i64 = 60000

/** The usage line `--help` prints. */
const USAGE: string =
  "usage: relay [--port N] [--bind ADDR] [--path /P] [--secret S] [--cert-out FILE] [--cert PEM --key PEM] [--san NAME]... [--offload]\n"

/** `n` bytes of entropy. */
const random = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  crypto.getRandomValues(out)
  return out
}

/** The monotonic clock in milliseconds. */
const nowMs = (): i64 => monotonicNanos() / 1000000

/** The wall clock in Unix milliseconds. */
const wallMs = (): i64 => toI64(Date.now())

/** Writes the `--cert-out` file for `id`, when one is asked for. */
const writeCertOut = (o: RelayOptions, id: RelayIdentity): void => {
  if (o.certOut.length === 0) {
    return
  }
  writeFileSync(o.certOut, relayCertOutBody(id))
  write(
    `[relay] ${id.pinned ? "certificate hash" : "a note saying there is no hash to pin"} written to ${o.certOut}\n`
  )
}

/** The client socket: the address asked for, or dual-stack and then IPv4. GRO is asked for, and done without where refused. */
const bindClient = (o: RelayOptions): i32 => {
  const hosts: string[] = o.bind.length > 0 ? [o.bind] : ["::", "0.0.0.0"]
  for (const host of hosts) {
    let fd: i32 = udpBind(host, o.port, 2)
    if (fd === -95) {
      fd = udpBind(host, o.port, 0)
    }
    if (fd >= 0) {
      write(`[relay] listening on https://localhost:${o.port}${o.path} (udp ${host} port ${o.port})\n`)
      return fd
    }
    writeError(
      `[relay] could not bind ${host} port ${o.port} (${fd})${host === "::" ? "; falling back to IPv4" : ""}\n`
    )
  }
  return -1
}

/**
 * Runs the relay until a signal (false) or until it is time to look at the
 * certificate files again (true): every `CERT_POLL_INTERVAL`, and only for a
 * PEM identity.
 */
const serveUntilPoll = (
  relay: Relay,
  source: RelaySource,
  key: Secret<u8[]>,
  grantKey: Secret<u8[]>
): boolean => {
  const nextPoll: i64 = nowMs() + CERT_POLL_INTERVAL
  let signalled: boolean = false
  while (!signalled) {
    const now: i64 = nowMs()
    let wait: i32 = relay.timeout(now)
    if (source.pem) {
      const untilPoll: i32 = nextPoll > now ? toI32(nextPoll - now) : 0
      wait = wait < 0 || untilPoll < wait ? untilPoll : wait
    }
    signalled = relay.step(now, wallMs(), key, grantKey, wait)
    if (!signalled && source.pem && nowMs() >= nextPoll) {
      return true
    }
  }
  return false
}

export const main = (): i32 => {
  const o = new RelayOptions()
  relayOptionsFromEnv(o)
  relayParseArgs(o, process.argv, 1)
  if (o.help) {
    write(USAGE)
    return 0
  }
  if (o.error.length > 0) {
    writeError(`[relay] ${o.error}\n`)
    return 2
  }
  if (o.secret === DEV_SECRET) {
    if (relayNamed(o.sans)) {
      writeError(
        "[relay] CS_RELAY_SECRET is still the development default, and it is the only thing stopping this relay being pointed at a third party. Generate one with `openssl rand -hex 32` and set it here and on every game server.\n"
      )
      return 2
    }
    write("[relay] forwarding grants signed with the development secret (local only)\n")
  }
  const source: RelaySource = relaySourceFrom(o.cert, o.key)
  if (source.error.length > 0) {
    writeError(`[relay] ${source.error}\n`)
    return 2
  }
  if (source.pem && toI32(o.sans.length) > 0) {
    writeError("[relay] --san is ignored with a real certificate; the names are the issuer's, not ours\n")
  }

  const id = new RelayIdentity()
  const first: Secret<u8[]> | null = source.pem ? relayLoadPem(source, id) : relayMintIdentity(wallMs(), id)
  if (first === null) {
    // Fatal here only: at boot there is nothing to fall back to.
    writeError(`[relay] ${id.error}\n`)
    return 2
  }
  let key: Secret<u8[]> = first
  writeCertOut(o, id)
  const watch = new RelayWatch(source)
  if (source.pem) {
    watch.mark()
    write("[relay] real certificate loaded; browsers validate it the ordinary way\n")
    write("[relay] a renewal is picked up live, without dropping sessions\n")
  } else {
    write(`[relay] self-signed certificate, pinned by hash ${id.hash}\n`)
    write(
      `[relay] it expires in ${SELF_SIGNED_DAYS} days and nothing renews it: restart inside that window\n`
    )
  }

  const fd: i32 = bindClient(o)
  if (fd < 0) {
    wipe(key)
    return 1
  }
  const config = new RelayConfig()
  config.path = o.path
  config.offload = o.offload
  const quicConfig = relayQuicConfig(
    id.chain,
    random(QUIC_CONN_STATIC_KEY_SIZE),
    random(QUIC_CONN_STATIC_KEY_SIZE)
  )
  const relay = new Relay(config, quicConfig, fd, new GrantVerifier(), random(QUIC_LISTENER_ENTROPY_SIZE))
  // The grant secret's bytes, held from here to the last `wipe` and exposed only to the HMAC.
  const grantKey: Secret<u8[]> = secret(httpFieldBytes(o.secret))
  // Without the signal descriptor SIGINT and SIGTERM would kill the process and no session would be
  // told CLOSE SHUTDOWN, so the relay refuses to start rather than run without its clean stop.
  const signals: i32 = signalFd()
  if (signals < 0) {
    writeError("[relay] could not take SIGINT and SIGTERM: refusing to run without a clean stop\n")
    wipe(key)
    wipe(grantKey)
    return 1
  }
  relay.watchSignals(signals)

  while (serveUntilPoll(relay, source, key, grantKey)) {
    const fresh = new RelayIdentity()
    const next: Secret<u8[]> | null = relayRenew(watch, fresh)
    if (next === null) {
      if (fresh.error.length > 0) {
        // Expected during a renewal: two files written by somebody else, not at the same instant.
        writeError(`[relay] ${fresh.error}; keeping the one already loaded\n`)
      }
    } else {
      // Handshakes from here on present the new chain and sign with the new key; live sessions keep theirs.
      quicConfig.certificateChain = fresh.chain
      wipe(key)
      key = next
      write("[relay] certificate reloaded; live sessions kept\n")
      writeCertOut(o, fresh)
    }
  }
  write("[relay] stopping: closing every session\n")
  relay.shutdown(nowMs())
  wipe(key)
  wipe(grantKey)
  return 0
}
