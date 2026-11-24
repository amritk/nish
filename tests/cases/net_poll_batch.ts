// pollWaitBatch (NURING-45) on a descriptor loop, with the program as its own
// peer. A minimum of 1 answers as pollWait does. On a loop with no ring slots
// a wait for more than one event answers what the first wait found, without
// waiting out maxWaitMs for the rest, and an idle wait answers 0 at its
// timeout, not its timeout plus maxWaitMs. A minimum of 1 or less, or a
// maxWaitMs of 0 or less, is pollWait: the unread datagram is still ready.
// -22 for a `ready` shorter than 2, -9 for a closed loop.
const MS: i64 = 1000000;

export const main = (): number => {
  const loop = pollCreate();
  const a = udpBind("127.0.0.1", 0, 0);
  const b = udpBind("127.0.0.1", 0, 0);
  const ready: i32[] = [0, 0, 0, 0];
  console.log(pollAdd(loop, a, 1, 7));

  // Idle: 0 at the timeout.
  let started = monotonicNanos();
  console.log(pollWaitBatch(loop, ready, 50, 4, 2000));
  let waited = (monotonicNanos() - started) / MS;
  console.log(waited >= 50 && waited < 1500);

  // One datagram: a minimum of 1 answers it, and so does a minimum of 4.
  const toA: u8[] = new Array<u8>(18);
  netAddress(toA, "127.0.0.1", netLocalPort(a));
  const data: u8[] = [1, 2, 3];
  console.log(udpSendTo(b, data, 0, 3, toA, 0, 0));
  console.log(pollWaitBatch(loop, ready, -1, 1, 0));
  console.log(`${ready[0]} ${ready[1]}`);
  started = monotonicNanos();
  console.log(pollWaitBatch(loop, ready, -1, 4, 2000));
  waited = (monotonicNanos() - started) / MS;
  console.log(waited < 1500);

  const none: i32[] = [0];
  console.log(pollWaitBatch(loop, none, 0, 1, 0));
  console.log(pollWaitBatch(loop, ready, 0, -1, 0));
  console.log(pollWaitBatch(loop, ready, 0, 1, -1));
  netClose(a);
  netClose(b);
  console.log(netClose(loop));
  console.log(pollWaitBatch(loop, ready, 0, 1, 0));
  return 0;
};
