// Forged-source Initials and the relay's per-address cap (#806). A UDP
// source address is whatever the sender wrote, so a handshake counts against
// its address's cap only once QUIC has validated it, by a Handshake packet
// from the client: Initials that name a real client's address, and never get
// further, hold a slot each until the hello deadline and none of the address's
// places. A validated client past the cap is still refused. With `retry` on,
// such an Initial is answered with a Retry and given no slot at all.
import { Suite } from "nish/testing";
import { CLOSE_RATE_LIMITED, RELAY_CLOSE, RelayFrame, relayDecode } from "../../../examples/relay/frame";
import { RELAY_CONNECTING, RelayConfig } from "../../../examples/relay/relay";
import { toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { frameText } from "../net_relay/frames";
import { Rig, RigClient } from "../net_relay/rig";

/** What the last datagram the relay sent `c` says, when it is a CLOSE: "code reason", else its type. */
const lastClose = (c: RigClient): string => {
  const d: u8[] = c.last();
  const f = new RelayFrame();
  const type: i32 = relayDecode(f, d, n32(0), toI32(d.length));
  return type === RELAY_CLOSE ? `${f.code} ${frameText(f, d)}` : `type ${type}`;
};

export const main = (): i32 => {
  const t = new Suite("relay forged");
  const config = new RelayConfig();
  config.maxSessions = 8;
  config.maxPerPeer = 2;
  config.spareSlots = 2;
  config.verbose = false;
  const rig = new Rig(config, false, false);
  // Four Initials from the address, more than its cap and its spare slots together, none finishing the handshake.
  const forged: RigClient[] = [];
  for (let k: i32 = 1; k <= 4; k++) {
    forged.push(rig.initial(k, "127.0.0.1"));
  }
  let answered: i32 = 0;
  for (const f of forged) {
    answered = answered + (f.closeCode < 0 && toI32(f.c.datagrams.length) > 0 ? 1 : 0);
  }
  t.eqI32("four Initials that never finish the handshake are each answered, and none closed", answered, n32(4));
  t.ok(
    "they hold no place of the address and no global place, and none is shed",
    rig.relay.peers.used === n32(0) && rig.relay.live === n32(0) && rig.relay.unplacedCount === n32(0) && rig.relay.shed === n32(0)
  );

  const a: RigClient = rig.session(n32(5), "127.0.0.1");
  const b: RigClient = rig.session(n32(6), "127.0.0.1");
  t.ok("two clients from that address then open sessions under its cap of two", toHex(a.last()).startsWith("02") && toHex(b.last()).startsWith("02"));
  const c: RigClient = rig.session(n32(7), "127.0.0.1");
  t.eqStr("a third validated client from it is refused", lastClose(c), `${CLOSE_RATE_LIMITED} too many sessions from this address`);
  t.ok("closed with code 1, holding no place", c.closeApp && c.closeCode === n64(1) && rig.relay.live === n32(2) && rig.relay.peers.used === n32(1));

  rig.advance(n64(5100), n64(700));
  let connecting: i32 = 0;
  for (let slot: i32 = 0; slot < rig.relay.size(); slot++) {
    connecting = connecting + (rig.relay.states[slot] === RELAY_CONNECTING ? 1 : 0);
  }
  t.ok("at the hello deadline the four are closed, counted, and their slots given back", connecting === n32(0) && rig.relay.connectTimeouts === n32(4));
  t.ok("and the two sessions keep their places", rig.relay.live === n32(2) && rig.relay.peers.used === n32(1));

  const retried = new Rig(config, false, true);
  const sent: RigClient[] = [];
  for (let k: i32 = 1; k <= 4; k++) {
    sent.push(retried.initial(k, "127.0.0.1"));
  }
  let retries: i32 = 0;
  for (const f of sent) {
    const first: u8[] = toI32(f.c.datagrams.length) > 0 ? f.c.datagrams[0] : [];
    retries = retries + (toI32(first.length) > 0 && (first[0] & toU8(0xf0)) === toU8(0xf0) ? 1 : 0);
  }
  t.eqI32("with retry on, each of four Initials without a token is answered with a Retry", retries, n32(4));
  let held: i32 = 0;
  for (let slot: i32 = 0; slot < retried.relay.size(); slot++) {
    held = held + (retried.relay.server.holds(slot) ? 1 : 0);
  }
  t.ok("and none of them holds a slot", held === n32(0) && retried.relay.unplacedCount === n32(0) && retried.relay.peers.used === n32(0));
  return t.done();
};
