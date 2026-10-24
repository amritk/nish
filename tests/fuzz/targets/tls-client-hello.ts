// The ClientHello reader (`nish/net/tls/codec`) over a peer's bytes, as a
// libFuzzer target: `fuzzOne` takes one input and keeps nothing past it, and a
// refusal is the view's `alert`, so a panic here is a finding
// (docs/security/tls.md).
//
// The first byte places the window: the body starts at `2 + data[0] % 8`, so a
// seed that keeps its four-byte handshake header uses 4 there and the header
// sits before the window. The second byte's low two bits trim that many bytes
// off the end, which leaves trailing bytes outside the window that the reader
// must not touch. The rest of the second byte picks a second window for the
// same view, one outside the input or cut short, which the reader must refuse
// rather than read: a view is made once per connection and every hello is read
// into it, so the second read also checks that `clear` forgets the first.
//
// A hello that parses is checked against what the reader promises: every
// window lies inside the body it was read from, and `tlsParseClientHello`
// copies out as many PSK identities as the view counted.
import {
  TlsClientHello,
  TlsClientHelloView,
  tlsParseClientHello,
  tlsReadClientHello,
  tlsSelectPskIdentity,
  tlsWindowHasU16,
  tlsWindowString,
} from "nish/net/tls/codec"

/**
 * Whether `[at, at + length)` lies inside `[from, to)`. An empty window passes
 * wherever it starts, since an absent extension leaves its window at 0.
 */
const inside = (at: i32, length: i32, from: i32, to: i32): boolean =>
  length === 0 || (length > 0 && at >= from && at <= to - length)

/** Panics with `what` unless the window `(at, length)` lies inside the body `[off, end)`. */
const expectInside = (what: string, at: i32, length: i32, off: i32, end: i32): void => {
  if (!inside(at, length, off, end)) {
    panic("tls-client-hello: a window outside its hello: " + what)
  }
}

/**
 * Checks a view that parsed: each window the server would read lies inside
 * the body, and every PSK identity it offered can be selected.
 */
const checkParsed = (view: TlsClientHelloView, off: i32, end: i32): void => {
  expectInside("random", view.randomAt, 32, off, end)
  expectInside("session id", view.sessionIdAt, view.sessionIdLength, off, end)
  expectInside("suites", view.suitesAt, view.suitesLength, off, end)
  expectInside("versions", view.versionsAt, view.versionsLength, off, end)
  expectInside("groups", view.groupsAt, view.groupsLength, off, end)
  expectInside("schemes", view.schemesAt, view.schemesLength, off, end)
  expectInside("shares", view.sharesAt, view.sharesLength, off, end)
  expectInside("x25519 share", view.x25519ShareAt, view.x25519ShareLength, off, end)
  expectInside("server name", view.serverNameAt, view.serverNameLength, off, end)
  expectInside("alpn", view.alpnAt, view.alpnLength, off, end)
  expectInside("quic", view.quicAt, view.quicLength, off, end)
  expectInside("extensions", view.extensionsAt, view.extensionsLength, off, end)
  expectInside("psk modes", view.pskModesAt, view.pskModesLength, off, end)
  if (view.hasPreSharedKey) {
    expectInside("psk identities", view.pskIdentitiesAt, view.pskIdentitiesLength, off, end)
    expectInside("psk binders", view.pskBindersAt, view.pskBindersLength, off, end)
  }
  for (let k: i32 = 0; k < view.pskIdentityCount; k++) {
    if (!tlsSelectPskIdentity(view, k)) {
      panic("tls-client-hello: a counted PSK identity cannot be selected")
    }
    expectInside("psk identity", view.pskIdentityAt, view.pskIdentityLength, off, end)
    expectInside("psk binder", view.pskBinderAt, view.pskBinderLength, off, end)
  }
}

/** Asks the view what a server asks of a hello, parsed or not: none of it may panic. */
const query = (view: TlsClientHelloView, data: u8[]): void => {
  tlsWindowHasU16(data, view.suitesAt, view.suitesLength, 0x1301)
  tlsWindowHasU16(data, view.versionsAt, view.versionsLength, 0x0304)
  tlsWindowHasU16(data, view.groupsAt, view.groupsLength, 0x001d)
  tlsWindowHasU16(data, view.schemesAt, view.schemesLength, 0x0804)
  tlsWindowString(data, view.serverNameAt, view.serverNameLength)
  tlsSelectPskIdentity(view, -1)
  tlsSelectPskIdentity(view, view.pskIdentityCount)
  tlsSelectPskIdentity(view, 0)
}

/** The second window, by `mode`: none, one past the input, one that starts before it, or the first cut short. */
const second = (view: TlsClientHelloView, data: u8[], mode: i32, off: i32, len: i32): void => {
  const n: i32 = toI32(data.length)
  if (mode === 1) {
    tlsReadClientHello(view, data, off, n - off + 1)
  } else if (mode === 2) {
    tlsReadClientHello(view, data, -1, len)
  } else if (mode === 3) {
    tlsReadClientHello(view, data, off, len > 0 ? len - 1 : 0)
  } else {
    return
  }
  if (mode !== 3 && view.alert === 0) {
    panic("tls-client-hello: a window outside the input parsed")
  }
  query(view, data)
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  if (n < 2) {
    return
  }
  let off: i32 = 2 + (toI32(data[0]) % 8)
  if (off > n) {
    off = n
  }
  let len: i32 = n - off - (toI32(data[1]) % 4)
  if (len < 0) {
    len = 0
  }
  const view: TlsClientHelloView = new TlsClientHelloView()
  tlsReadClientHello(view, data, off, len)
  query(view, data)
  const parsed: TlsClientHello = tlsParseClientHello(data, off, len)
  if (parsed.alert !== view.alert) {
    panic("tls-client-hello: the parse and the view disagree on the alert")
  }
  if (view.alert === 0) {
    checkParsed(view, off, off + len)
    if (toI32(parsed.pskIdentities.length) !== view.pskIdentityCount) {
      panic("tls-client-hello: the parse copied a different number of PSK identities")
    }
  }
  second(view, data, (toI32(data[1]) >> 2) % 4, off, len)
}
