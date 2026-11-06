// The relay when a player's NAT rebinds mid-session (RFC 9000 §9.3): the
// client moves to a new socket on another loopback address, its session goes
// on there, DATA both ways, and the per-peer table keeps counting the session
// against the address it was placed under, giving it back there when the
// session ends.
import { netAddress, netClose, udpRecvFrom } from "nish:net";
import { Suite } from "nish/testing";
import { RELAY_DATA } from "../../../examples/relay/frame";
import { n32 } from "../net_quic_frame/typed";
import { rigConfig, rigData } from "./loopback";
import { Rig, RigClient } from "./rig";

/** The 18-byte `nish:net` form of `host`, port 0: its first sixteen bytes are what the per-peer table keys on. */
const peerKey = (host: string): u8[] => {
  const out: u8[] = new Array<u8>(18);
  netAddress(out, host, n32(0));
  return out;
};

/** How many DATA frames the relay has sent `c`. */
const downs = (c: RigClient): i32 => {
  let n: i32 = 0;
  for (const d of c.datagrams) {
    if (toI32(d.length) > 0 && toI32(d[0]) === RELAY_DATA) {
      n++;
    }
  }
  return n;
};

/** How many datagrams are waiting on `fd`, read and dropped. */
const drain = (fd: i32): i32 => {
  const rx: u8[] = new Array<u8>(65536);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [n32(0), n32(0)];
  let count: i32 = 0;
  while (udpRecvFrom(fd, rx, n32(0), n32(65536), from, meta) >= 0) {
    count++;
  }
  return count;
};

/** A session whose client moves from 127.0.0.1 to 127.0.0.2. */
const moved = (t: Suite): void => {
  const rig = new Rig(rigConfig(), false, false);
  const c: RigClient = rig.session(n32(1), "127.0.0.1");
  const first: u8[] = peerKey("127.0.0.1");
  const second: u8[] = peerKey("127.0.0.2");
  t.ok("before the rebinding, the session is counted against 127.0.0.1", rig.relay.peers.count(first) === n32(1) && rig.relay.live === n32(1));

  const old: i32 = c.rebind("127.0.0.2");
  rig.wait.watch(c.fd);
  const upBefore: string = rig.echo.seen();
  c.send(rigData(n32(1), n32(100), n32(0x11)));
  rig.settle(n32(50));
  t.ok("after the client moves to 127.0.0.2, its DATA still reaches the game server", rig.echo.seen() !== upBefore && rig.echo.seen().endsWith("100"));
  t.ok("the relay's QUIC validated the new address with a PATH_CHALLENGE the client answered", c.challenges > n32(0));
  const downBefore: i32 = downs(c);
  rig.echo.reply(rigData(n32(2), n32(50), n32(0x22)));
  rig.settle(n32(50));
  t.eqI32("and the game server's reply reaches the client at its new address", downs(c), downBefore + n32(1));
  t.eqI32("nothing after the rebinding went to the old address", drain(old), n32(0));
  t.ok(
    "the per-peer table still counts the session against 127.0.0.1, where it was placed, and nothing against 127.0.0.2",
    rig.relay.peers.count(first) === n32(1) && rig.relay.peers.count(second) === n32(0) && rig.relay.peers.used === n32(1)
  );

  c.quit();
  rig.settle(n32(50));
  t.ok(
    "when the session ends, its place goes back under 127.0.0.1: neither address holds one, and no row is left",
    rig.relay.live === n32(0) && rig.relay.peers.count(first) === n32(0) && rig.relay.peers.count(second) === n32(0) && rig.relay.peers.used === n32(0)
  );
  netClose(old);
};

/** Every rebinding check. */
export const rebindChecks = (t: Suite): void => {
  moved(t);
};
