// The server-flight readers (`nish/net/tls/codec`) and the client that runs
// them (`nish/net/tls/client`) over a peer's bytes, as a libFuzzer target:
// `fuzzOne` takes one input and keeps nothing past it, and a refusal is an
// alert, so a panic here is a finding (docs/security/tls.md).
//
// The first byte's low three bits pick the mode. 0 to 4 run one reader —
// ServerHello, EncryptedExtensions, Certificate, CertificateVerify or
// NewSessionTicket — over a body that starts at `2 + data[1] % 8` and ends
// `(data[1] >> 3) % 4` bytes short of the input, so the bytes around the
// window are ones the reader must not touch. A message that parses is checked
// against what the reader promises: every window lies inside its body, and
// `tlsCopyCertificates` copies as many certificates as the view counted.
//
// 5 to 7 hand everything after the first two bytes to a started client, in
// chunks of `(data[0] >> 3) + 1` bytes: at the Initial level, then the last
// `data[1]` bytes at the Handshake level. The state machine, the
// ServerHello and HelloRetryRequest checks and a second ClientHello all run
// over it. An alert must leave the client failed and answering that alert.
import {
  TlsServerFlightView,
  tlsCopyCertificates,
  tlsReadCertificate,
  tlsReadCertificateVerify,
  tlsReadEncryptedExtensions,
  tlsReadNewSessionTicket,
  tlsReadServerHello,
  tlsServerHelloDowngrade,
  tlsWindowString,
} from "nish/net/tls/codec"
import { TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL } from "nish/net/tls"
import { TLS_CLIENT_STATE_FAILED, TlsClient, TlsClientConfig } from "nish/net/tls/client"

/**
 * Whether `[at, at + length)` lies inside `[from, to)`. An empty window passes
 * wherever it starts, since an absent field leaves its window at 0.
 */
const inside = (at: i32, length: i32, from: i32, to: i32): boolean =>
  length === 0 || (length > 0 && at >= from && at <= to - length)

/** Panics with `what` unless the window `(at, length)` lies inside the body `[off, end)`. */
const expectInside = (what: string, at: i32, length: i32, off: i32, end: i32): void => {
  if (!inside(at, length, off, end)) {
    panic("tls-server-flight: a window outside its message: " + what)
  }
}

/** Runs reader `mode` over `data[off .. off + len)` and checks a message that parsed. */
const readOne = (mode: i32, data: u8[], off: i32, len: i32): void => {
  const view: TlsServerFlightView = new TlsServerFlightView()
  const end: i32 = off + len
  if (mode === 0) {
    tlsReadServerHello(view, data, off, len)
    tlsServerHelloDowngrade(view)
  } else if (mode === 1) {
    tlsReadEncryptedExtensions(view, data, off, len)
  } else if (mode === 2) {
    tlsReadCertificate(view, data, off, len)
  } else if (mode === 3) {
    tlsReadCertificateVerify(view, data, off, len)
  } else {
    tlsReadNewSessionTicket(view, data, off, len)
  }
  if (view.alert !== 0) {
    return
  }
  expectInside("random", view.randomAt, mode === 0 ? 32 : 0, off, end)
  expectInside("session id", view.sessionIdAt, view.sessionIdLength, off, end)
  expectInside("share", view.shareAt, view.shareLength, off, end)
  expectInside("cookie", view.cookieAt, view.cookieLength, off, end)
  expectInside("alpn", view.alpnAt, view.alpnLength, off, end)
  expectInside("certificates", view.certificatesAt, view.certificatesLength, off, end)
  expectInside("signature", view.signatureAt, view.signatureLength, off, end)
  tlsWindowString(data, view.alpnAt, view.alpnLength)
  if (mode === 2 && toI32(tlsCopyCertificates(view).length) !== view.certificateCount) {
    panic("tls-server-flight: the copy and the view disagree on the certificate count")
  }
}

/** Fixed key material: the client's randomness is not what is under test. */
const filled = (value: i32): u8[] => {
  const out: u8[] = new Array<u8>(32)
  out.fill(toU8(value))
  return out
}

/** Hands `data[2 ..)` to a started client in chunks of `chunk`, the last `data[1]` bytes at the Handshake level. */
const runClient = (data: u8[], chunk: i32): void => {
  const n: i32 = toI32(data.length)
  const config: TlsClientConfig = new TlsClientConfig("example.com", ["h2"])
  config.groups = [0x001d, 0x0017]
  const client: TlsClient = new TlsClient(config, filled(1), filled(2), filled(3))
  client.start()
  const split: i32 = n - toI32(data[1]) > 2 ? n - toI32(data[1]) : 2
  let at: i32 = 2
  let alert: i32 = 0
  while (alert === 0 && at < n) {
    const level: i32 = at < split ? TLS_LEVEL_INITIAL : TLS_LEVEL_HANDSHAKE
    const stop: i32 = at < split ? split : n
    const take: i32 = stop - at < chunk ? stop - at : chunk
    alert = client.receive(level, data, at, take)
    at = at + take
  }
  if (alert !== 0) {
    if (client.state !== TLS_CLIENT_STATE_FAILED) {
      panic("tls-server-flight: an alert left the client running")
    }
    if (client.receive(TLS_LEVEL_INITIAL, data, 0, 1) !== alert) {
      panic("tls-server-flight: a failed client answered another alert")
    }
  }
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  if (n < 2) {
    return
  }
  const mode: i32 = toI32(data[0]) % 8
  if (mode >= 5) {
    runClient(data, (toI32(data[0]) >> 3) + 1)
    return
  }
  let off: i32 = 2 + (toI32(data[1]) % 8)
  if (off > n) {
    off = n
  }
  let len: i32 = n - off - ((toI32(data[1]) >> 3) % 4)
  if (len < 0) {
    len = 0
  }
  readOne(mode, data, off, len)
}
