/**
 * The relay's command line and environment, as main.rs's `Options` and
 * `parse_options`: the environment first, then the command line over it.
 *
 * | Flag | Environment | Default |
 * | --- | --- | --- |
 * | `--port N` | `CS_RELAY_PORT` | 4433 |
 * | `--bind ADDR` | `CS_RELAY_BIND` | `::`, falling back to `0.0.0.0` |
 * | `--path /P` | `CS_RELAY_PATH` | `/cs` |
 * | `--secret S` | `CS_RELAY_SECRET` | `cs-dev-secret` (the development secret) |
 * | `--cert-out FILE` | `CS_RELAY_CERT_OUT` | none |
 * | `--cert PEM` | `CS_RELAY_TLS_CERT` | none (self-signed) |
 * | `--key PEM` | `CS_RELAY_TLS_KEY` | none |
 * | `--san NAME`, repeatable | `CS_RELAY_SAN`, comma-separated | none |
 * | `--offload` | `CS_RELAY_OFFLOAD` of `1`, `true` or `yes` | off |
 * | `--help` | — | — |
 *
 * `CS_RELAY_TLS_CERT` rather than `CS_RELAY_CERT`, which the game server
 * already uses for the path of the hash file this process writes. A value
 * that does not parse in the environment is ignored, as main.rs ignores it;
 * on the command line it is an error, and so is an option without its value
 * or one main.rs does not have. One addition: `--help`, which main.rs lacks.
 */
import { netAddress } from "nish:net"
import { getenv } from "nish:process"

/** The development secret: a string in a public repository. */
export const DEV_SECRET: string = "cs-dev-secret"

/** What the command line and the environment asked for. */
export class RelayOptions {
  bind: string = ""
  path: string = "/cs"
  secret: string = "cs-dev-secret"
  certOut: string = ""
  cert: string = ""
  key: string = ""
  sans: string[]
  /** Why the options are refused, or "". */
  error: string = ""
  port: i32 = 4433
  offload: boolean = false
  help: boolean = false

  constructor() {
    this.sans = []
  }
}

/** The decimal port `text` spells, or -1. */
export const relayPortOf = (text: string): i32 => {
  const n: i32 = toI32(text.length)
  if (n < 1 || n > 5) {
    return -1
  }
  let v: i32 = 0
  for (let k: i32 = 0; k < n; k++) {
    const d: i32 = toI32(text.charCodeAt(k)) - 48
    if (d < 0 || d > 9) {
      return -1
    }
    v = v * 10 + d
  }
  return v <= 65535 ? v : -1
}

/** Whether `text` is an IP address literal. */
export const relayIsAddress = (text: string): boolean => {
  const scratch: u8[] = new Array<u8>(18)
  return netAddress(scratch, text, 0) === 0
}

/** Each comma-separated part of `text`, trimmed of spaces, onto `into`; empty parts are dropped. */
export const relaySplitSans = (text: string, into: string[]): void => {
  let start: i32 = 0
  const n: i32 = toI32(text.length)
  for (let k: i32 = 0; k <= n; k++) {
    if (k === n || (k >= 0 && k < toI32(text.length) && text.charCodeAt(k) === 44)) {
      let a: i32 = start
      let b: i32 = k
      while (a >= 0 && a < b && a < toI32(text.length) && text.charCodeAt(a) === 32) {
        a = a + 1
      }
      while (b > a && b - 1 >= 0 && b - 1 < toI32(text.length) && text.charCodeAt(b - 1) === 32) {
        b = b - 1
      }
      if (b > a && a >= 0 && b <= toI32(text.length)) {
        into.push(text.slice(a, b))
      }
      start = k + 1
    }
  }
}

/** The environment's options into `o`. */
export const relayOptionsFromEnv = (o: RelayOptions): void => {
  const port: string | null = getenv("CS_RELAY_PORT")
  if (port !== null && relayPortOf(port) >= 0) {
    o.port = relayPortOf(port)
  }
  const bind: string | null = getenv("CS_RELAY_BIND")
  if (bind !== null && relayIsAddress(bind)) {
    o.bind = bind
  }
  const path: string | null = getenv("CS_RELAY_PATH")
  if (path !== null) {
    o.path = path
  }
  const secretText: string | null = getenv("CS_RELAY_SECRET")
  if (secretText !== null) {
    o.secret = secretText
  }
  const certOut: string | null = getenv("CS_RELAY_CERT_OUT")
  if (certOut !== null) {
    o.certOut = certOut
  }
  const cert: string | null = getenv("CS_RELAY_TLS_CERT")
  if (cert !== null) {
    o.cert = cert
  }
  const key: string | null = getenv("CS_RELAY_TLS_KEY")
  if (key !== null) {
    o.key = key
  }
  const sans: string | null = getenv("CS_RELAY_SAN")
  if (sans !== null) {
    relaySplitSans(sans, o.sans)
  }
  // Present rather than truthy: `CS_RELAY_OFFLOAD=0` meaning "on" is a trap.
  const offload: string | null = getenv("CS_RELAY_OFFLOAD")
  o.offload = offload !== null && (offload === "1" || offload === "true" || offload === "yes")
}

/** The command line `argv[from ..]` over `o`; a refusal is `o.error`. */
export const relayParseArgs = (o: RelayOptions, argv: readonly string[], from: i32): void => {
  let i: i32 = from
  while (i >= 0 && i < toI32(argv.length)) {
    const flag: string = argv[i]
    // The switches, taken before the lookup: every other option names a thing.
    if (flag === "--offload" || flag === "--help") {
      o.offload = o.offload || flag === "--offload"
      o.help = o.help || flag === "--help"
      i = i + 1
      continue
    }
    // Against the length itself, not a copy hoisted above the loop: the calls
    // in the body forget what a hoisted copy said about `argv`, and this guard
    // is what proves the read of the value after it.
    if (i + 1 >= toI32(argv.length)) {
      o.error = `${flag} needs a value`
      return
    }
    const value: string = argv[i + 1]
    if (flag === "--port") {
      if (relayPortOf(value) < 0) {
        o.error = `bad port ${value}`
        return
      }
      o.port = relayPortOf(value)
    } else if (flag === "--bind") {
      if (!relayIsAddress(value)) {
        o.error = `bad bind address ${value}`
        return
      }
      o.bind = value
    } else if (flag === "--path") {
      o.path = value
    } else if (flag === "--secret") {
      o.secret = value
    } else if (flag === "--cert-out") {
      o.certOut = value
    } else if (flag === "--cert") {
      o.cert = value
    } else if (flag === "--key") {
      o.key = value
    } else if (flag === "--san") {
      o.sans.push(value)
    } else {
      o.error = `unknown option ${flag}`
      return
    }
    i = i + 2
  }
  if (o.path.length === 0 || o.path.charCodeAt(0) !== 47) {
    o.error = `bad path ${o.path}: a path starts with /`
  }
}

/**
 * Whether the development secret must be refused: some `--san` is a host
 * name rather than an address literal or `localhost`, which is a deployment
 * saying browsers reach this relay by name (main.rs's `named`).
 */
export const relayNamed = (sans: string[]): boolean => {
  let named: boolean = false
  for (const san of sans) {
    named = named || (san.length > 0 && san !== "localhost" && !relayIsAddress(san))
  }
  return named
}
