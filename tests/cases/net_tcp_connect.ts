// WP34 N5, #357: the client half of TCP, with a Nish server as its peer in the
// same loop, through the globals. `tcpConnect` answers the descriptor while
// the connection is still being made; the loop reports it writable once it is,
// and `connectResult` then says how it went. The first exchange is one
// message and the second two hundred, each echoed by the server and checked
// byte for byte by the client, and the arena must move as far over the second
// as over the first: nothing allocates. A port nobody listens on is refused,
// -111, read once. The `net_tcp_connect` block of tests/run.js runs it under a
// timeout, so a wake that never comes fails rather than hangs. -22 for an
// address shorter than 18 bytes, -9 for a descriptor that is not one.
const WOULD_BLOCK: i32 = -11;
const LISTENER: i32 = 1;
const CLIENT: i32 = 2;
const SERVER: i32 = 3;
const REFUSED: i32 = 4;

/** Wait until `token` is ready: its events, or -1 when five seconds pass first. */
const waitFor = (loop: i32, ready: i32[], token: i32): i32 => {
  while (true) {
    const n = pollWait(loop, ready, 5000);
    if (n <= 0) {
      return -1;
    }
    for (let i = 0; i < n; i++) {
      if (ready[2 * i] === token) {
        return ready[2 * i + 1];
      }
    }
  }
};

/** Exactly `buf[0, len)` from `fd`, waiting on `token` while none is there: 0, or the failure. */
const readAll = (loop: i32, ready: i32[], token: i32, fd: i32, buf: u8[], len: i32): i32 => {
  let got = 0;
  while (got < len) {
    const n = netRead(fd, buf, got, len - got);
    if (n === WOULD_BLOCK) {
      if (waitFor(loop, ready, token) < 0) {
        return -1;
      }
    } else if (n <= 0) {
      return n === 0 ? -1 : n;
    } else {
      got = got + n;
    }
  }
  return 0;
};

/**
 * Connect to `addr`, accept on `listener`, and echo `messages` messages of
 * `size` bytes through the server: the messages that came back intact, or a
 * failure's negative answer.
 */
const exchange = (loop: i32, ready: i32[], listener: i32, addr: u8[], messages: i32, size: i32): i32 => {
  const client = tcpConnect(addr);
  if (client < 0) {
    return client;
  }
  pollAdd(loop, client, 2, CLIENT);
  if (waitFor(loop, ready, CLIENT) < 0) {
    return -1;
  }
  const made = connectResult(client);
  if (made !== 0) {
    return made;
  }
  if (waitFor(loop, ready, LISTENER) < 0) {
    return -1;
  }
  const peer: u8[] = new Array<u8>(18);
  const conn = tcpAccept(listener, peer);
  if (conn < 0) {
    return conn;
  }
  pollModify(loop, client, 1, CLIENT);
  pollAdd(loop, conn, 1, SERVER);
  const sent: u8[] = new Array<u8>(size);
  const relay: u8[] = new Array<u8>(size);
  const back: u8[] = new Array<u8>(size);
  let intact = 0;
  for (let m = 0; m < messages; m++) {
    for (let k = 0; k < sent.length; k++) {
      sent[k] = toU8((m * 7 + k) & 255);
    }
    if (
      netWrite(client, sent, 0, size) !== size ||
      readAll(loop, ready, SERVER, conn, relay, size) !== 0 ||
      netWrite(conn, relay, 0, size) !== size ||
      readAll(loop, ready, CLIENT, client, back, size) !== 0
    ) {
      break;
    }
    let same = true;
    for (let k = 0; k < back.length && k < sent.length; k++) {
      if (back[k] !== sent[k]) {
        same = false;
      }
    }
    if (same) {
      intact = intact + 1;
    }
  }
  netClose(client);
  // The client's close is the server's end of stream, a read of 0.
  const end = waitFor(loop, ready, SERVER) < 0 ? -1 : netRead(conn, relay, 0, 1);
  netClose(conn);
  console.log(`peer ${peer[12]}.${peer[13]}.${peer[14]}.${peer[15]}, end of stream ${end}`);
  return intact;
};

export const main = (): number => {
  const short: u8[] = new Array<u8>(17);
  console.log(`short ${tcpConnect(short)}`);
  console.log(`not a descriptor ${connectResult(-1)}`);

  const loop = pollCreate();
  const ready: i32[] = new Array<i32>(8);
  const listener = tcpListen("127.0.0.1", 0, 8);
  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", netLocalPort(listener));
  pollAdd(loop, listener, 1, LISTENER);

  const before = Arena.used();
  const first = exchange(loop, ready, listener, addr, 1, 64);
  const one = Arena.used() - before;
  const second = exchange(loop, ready, listener, addr, 200, 64);
  const many = Arena.used() - before - one;
  console.log(`one: ${first} intact, many: ${second} intact`);
  console.log(one === many ? "flat" : `grows: ${one} then ${many}`);

  // A port that was bound and is closed again: nobody listens there.
  const gone = tcpListen("127.0.0.1", 0, 1);
  netAddress(addr, "127.0.0.1", netLocalPort(gone));
  netClose(gone);
  const refused = tcpConnect(addr);
  let answer = refused;
  if (refused >= 0) {
    pollAdd(loop, refused, 2, REFUSED);
    answer = waitFor(loop, ready, REFUSED) < 0 ? -1 : connectResult(refused);
  }
  console.log(`refused ${answer}`);
  console.log(`read once ${refused >= 0 ? connectResult(refused) : 0}`);
  netClose(refused);
  netClose(listener);
  return netClose(loop);
};
