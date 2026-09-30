// WP34 N5: every answer of the readiness loop a program can pin with itself as
// the peer, through the globals. A socket with nothing waiting is not
// readable, so a wait on it times out: 0, after at least the timeout. A
// datagram makes it readable under its token, and it stays readable until it
// is read, because readiness is level-triggered. A UDP socket is always
// writable. A `ready` of two numbers holds one pair, however many are ready.
// `pollModify` changes the events and the token, `pollRemove` stops the
// watching, and shutting a socket's both sides is a hang-up, 4. -22 for an
// event bit past 2 and for a `ready` shorter than 2, -17 for a descriptor
// added twice, -2 for one that was never added, -9 for a closed loop.
const MS: i64 = 1000000;

export const main = (): number => {
  const loop = pollCreate();
  const a = udpBind("127.0.0.1", 0, 0);
  const b = udpBind("127.0.0.1", 0, 0);
  console.log(loop >= 0 && a >= 0 && b >= 0);
  const ready: i32[] = [0, 0, 0, 0, 0, 0];
  const pair: i32[] = [0, 0];
  const none: i32[] = [0];

  // Nothing ready: a timeout, which waited at least as long as it was asked.
  console.log(pollAdd(loop, a, 1, 7));
  const started = monotonicNanos();
  console.log(pollWait(loop, ready, 50));
  const waited = (monotonicNanos() - started) / MS;
  console.log(waited >= 50 && waited < 5000);

  // A datagram from b to a: ready under a's token, and again, until read.
  const toA: u8[] = new Array<u8>(18);
  netAddress(toA, "127.0.0.1", netLocalPort(a));
  const data: u8[] = [1, 2, 3];
  console.log(udpSendTo(b, data, 0, 3, toA, 0, 0));
  console.log(pollWait(loop, ready, -1));
  console.log(`${ready[0]} ${ready[1]}`);
  console.log(pollWait(loop, ready, 0));

  // b watched for writing too: two ready, and a `pair` holds only one.
  console.log(pollAdd(loop, b, 2, 8));
  console.log(pollWait(loop, ready, 0));
  console.log(pollWait(loop, pair, 0));

  // a's token and events changed, then b no longer watched.
  console.log(pollModify(loop, a, 3, 9));
  console.log(pollRemove(loop, b));
  console.log(pollWait(loop, ready, 0));
  console.log(`${ready[0]} ${ready[1]}`);

  // Both sides of a shut: readable, writable and hung up.
  netShutdown(a, 2);
  console.log(pollWait(loop, ready, 0));
  console.log(`${ready[0]} ${ready[1]}`);

  console.log(pollAdd(loop, b, 4, 1));
  console.log(pollWait(loop, none, 0));
  console.log(pollAdd(loop, a, 1, 1));
  console.log(pollRemove(loop, b));
  console.log(pollModify(loop, b, 1, 1));
  netClose(a);
  netClose(b);
  console.log(netClose(loop));
  console.log(pollWait(loop, ready, 0));
  console.log(pollAdd(loop, 0, 1, 1));
  return 0;
};
