// A loopback stand-in PostgreSQL backend in the same process as the pool it
// serves, so the tests need no server. `backend` accepts one connection,
// answers its startup with `trust` (AuthenticationOk, client_encoding UTF8,
// BackendKeyData, ReadyForQuery) and then each Parse, Bind, Execute and Sync
// by the statement's text:
//
//   hold   a row `held`, but only once `board.done` reaches 2
//   quick  a row `q`
//   echo   one row holding the parameters as sent, NULL as NULL
//   many   five rows
//   bad    an ErrorResponse, SQLSTATE 42P01
//   begin  BEGIN, then a ReadyForQuery inside a transaction
//   set    a ParameterStatus, as a `SET` makes the server send
//   die    the connection closes with no answer
//   short  a DataRow whose length, 3, is under its own 4 bytes
//   big    a DataRow whose length says 2,000,000 bytes, and none of them
//   wide   a DataRow of 2000 columns, past `maxColumns`
//   odd    a message of type `W`, which no extended query answers
//
// The board is the one object the backends share with the test's tasks; a
// backend's task body writes its `seen` count, and its helpers only read it.
import { readable, sleep, writable } from "nish:async"
import { netClose, netRead, netWrite, tcpAccept } from "nish:net"

/** What the backends and the test's tasks share. */
export class Board {
  /** Statements the backends have answered or dropped. */
  seen: i32 = 0
  /** Client tasks that have finished. */
  done: i32 = 0
}

/** One connection's input, task-owned. */
export class Wire {
  buf: u8[]
  start: i32 = 0
  end: i32 = 0
  body: i32 = 0
  stop: i32 = 0

  constructor() {
    this.buf = new Array<u8>(65536)
  }

  /** The big-endian i32 at `p`. */
  int32(p: i32): i32 {
    return (toI32(this.buf[p]) << 24) | (toI32(this.buf[p + 1]) << 16) | (toI32(this.buf[p + 2]) << 8) | toI32(this.buf[p + 3])
  }

  /** The big-endian u16 at `p`. */
  int16(p: i32): i32 {
    return (toI32(this.buf[p]) << 8) | toI32(this.buf[p + 1])
  }

  /** The NUL-ended text at `p`. */
  cstr(p: i32): string {
    let e: i32 = p
    while (toI32(this.buf[e]) !== 0) {
      e += 1
    }
    return String.fromBytes(this.buf, p, e)
  }

  /** The length of the whole message at `start`, or 0 while part of it is still to come. */
  whole(typed: boolean): i32 {
    const head: i32 = typed ? 5 : 4
    if (this.end - this.start < head) {
      return 0
    }
    const total: i32 = this.int32(this.start + head - 4) + head - 4
    return this.end - this.start < total ? 0 : total
  }

  /** Moves the unread bytes to the front. */
  compact(): void {
    for (let i: i32 = this.start; i < this.end; i++) {
      this.buf[i - this.start] = this.buf[i]
    }
    this.end -= this.start
    this.start = 0
    this.stop = 0
  }
}

/** One connection's output, task-owned. */
export class Out {
  bytes: u8[]
  n: i32 = 0
  mark: i32 = 0

  constructor() {
    this.bytes = new Array<u8>(65536)
  }

  byte(b: i32): void {
    this.bytes[this.n] = toU8(b)
    this.n += 1
  }

  int32(v: i32): void {
    this.byte((v >> 24) & 255)
    this.byte((v >> 16) & 255)
    this.byte((v >> 8) & 255)
    this.byte(v & 255)
  }

  int16(v: i32): void {
    this.byte((v >> 8) & 255)
    this.byte(v & 255)
  }

  text(s: string): void {
    for (let i: i32 = 0; i < toI32(s.length); i++) {
      this.byte(toI32(s.charCodeAt(i)))
    }
  }

  cstr(s: string): void {
    this.text(s)
    this.byte(0)
  }

  /** Starts a message of `type`; `finish` writes its length. */
  begin(type: i32): void {
    this.byte(type)
    this.mark = this.n
    this.int32(0)
  }

  finish(): void {
    const len: i32 = this.n - this.mark
    const at: i32 = this.n
    this.n = this.mark
    this.int32(len)
    this.n = at
  }

  /** A DataRow of one text cell. */
  row(cell: string): void {
    this.begin(68)
    this.int16(1)
    this.int32(toI32(cell.length))
    this.text(cell)
    this.finish()
  }

  complete(tag: string): void {
    this.begin(67)
    this.cstr(tag)
    this.finish()
  }

  ready(status: i32): void {
    this.begin(90)
    this.byte(status)
    this.finish()
  }
}

/** Accepts one connection, polling every 2 ms for at most two seconds; -1 when none came. */
async function acceptOne(listen: i32): Promise<i32> {
  const peer: u8[] = new Array<u8>(32)
  for (let waited: i32 = 0; waited < 2000; waited += 2) {
    const fd: i32 = tcpAccept(listen, peer)
    if (fd !== -11) {
      return fd
    }
    await sleep(2)
  }
  return -1
}

/** The next message into `w` (its type, 0 for the untyped startup), or -1 when the peer left. */
async function nextMessage(fd: i32, w: Wire, typed: boolean): Promise<i32> {
  w.start = w.stop
  while (true) {
    const total: i32 = w.whole(typed)
    if (total > 0) {
      w.body = w.start + (typed ? 5 : 4)
      w.stop = w.start + total
      return typed ? toI32(w.buf[w.start]) : 0
    }
    w.compact()
    const n: i32 = netRead(fd, w.buf, w.end, toI32(w.buf.length) - w.end)
    if (n === -11) {
      const ok: boolean = await readable(fd)
      if (!ok) {
        return -1
      }
    } else if (n <= 0) {
      return -1
    } else {
      w.end += n
    }
  }
}

/** Writes `o`'s bytes to `fd` and empties it; false when the peer left. */
async function flush(fd: i32, o: Out): Promise<boolean> {
  let at: i32 = 0
  while (at < o.n) {
    const n: i32 = netWrite(fd, o.bytes, at, o.n - at)
    if (n === -11) {
      const ok: boolean = await writable(fd)
      if (!ok) {
        return false
      }
    } else if (n <= 0) {
      return false
    } else {
      at += n
    }
  }
  o.n = 0
  return true
}

/** Reads the startup message and answers it as a `trust` server; false when the peer left. */
async function handshake(fd: i32, w: Wire, o: Out): Promise<boolean> {
  const first: i32 = await nextMessage(fd, w, false)
  if (first < 0) {
    return false
  }
  o.begin(82)
  o.int32(0)
  o.finish()
  o.begin(83)
  o.cstr("client_encoding")
  o.cstr("UTF8")
  o.finish()
  o.begin(75)
  o.int32(4242)
  o.int32(99)
  o.finish()
  o.ready(73)
  return await flush(fd, o)
}

/**
 * Reads one Parse, Bind, Execute and Sync and answers it; 0 to go on, 1 when
 * the connection is done. It reads `board` and writes nothing into it.
 */
async function serveQuery(fd: i32, w: Wire, o: Out, board: Board): Promise<i32> {
  let sql: string = ""
  const values: string[] = []
  const nulls: boolean[] = []
  while (true) {
    const type: i32 = await nextMessage(fd, w, true)
    if (type < 0 || type === 88) {
      return 1
    }
    if (type === 80) {
      // Parse: the statement name, then the text.
      let p: i32 = w.body
      while (toI32(w.buf[p]) !== 0) {
        p += 1
      }
      sql = w.cstr(p + 1)
    } else if (type === 66) {
      // Bind: portal, statement, format codes, then the values.
      let p: i32 = w.body
      while (toI32(w.buf[p]) !== 0) {
        p += 1
      }
      p += 1
      while (toI32(w.buf[p]) !== 0) {
        p += 1
      }
      p += 1
      p += 2 + 2 * w.int16(p)
      const count: i32 = w.int16(p)
      p += 2
      for (let i: i32 = 0; i < count; i++) {
        const n: i32 = w.int32(p)
        p += 4
        if (n < 0) {
          values.push("")
          nulls.push(true)
        } else {
          values.push(String.fromBytes(w.buf, p, p + n))
          nulls.push(false)
          p += n
        }
      }
    } else if (type === 83) {
      break
    }
  }
  if (sql === "die") {
    return 1
  }
  if (sql === "hold") {
    while (board.done < 2) {
      await sleep(1)
    }
  }
  o.begin(49)
  o.finish()
  o.begin(50)
  o.finish()
  let status: i32 = 73
  if (sql === "hold") {
    o.row("held")
    o.complete("SELECT 1")
  } else if (sql === "echo") {
    o.begin(68)
    o.int16(toI32(values.length))
    for (let i: i32 = 0; i < toI32(values.length); i++) {
      if (nulls[i]) {
        o.int32(-1)
      } else {
        o.int32(toI32(values[i].length))
        o.text(values[i])
      }
    }
    o.finish()
    o.complete("SELECT 1")
  } else if (sql === "many") {
    for (let i: i32 = 0; i < 5; i++) {
      o.row(`r${i}`)
    }
    o.complete("SELECT 5")
  } else if (sql === "bad") {
    o.begin(69)
    o.byte(83)
    o.cstr("ERROR")
    o.byte(67)
    o.cstr("42P01")
    o.byte(77)
    o.cstr("relation \"nope\" does not exist")
    o.byte(0)
    o.finish()
  } else if (sql === "short") {
    o.byte(68)
    o.int32(3)
  } else if (sql === "big") {
    o.byte(68)
    o.int32(2000000)
  } else if (sql === "wide") {
    o.begin(68)
    o.int16(2000)
    o.finish()
  } else if (sql === "odd") {
    o.begin(87)
    o.finish()
  } else if (sql === "begin") {
    o.complete("BEGIN")
    status = 84
  } else if (sql === "set") {
    o.begin(83)
    o.cstr("TimeZone")
    o.cstr("Europe/Paris")
    o.finish()
    o.complete("SET")
  } else {
    o.row("q")
    o.complete("SELECT 1")
  }
  o.ready(status)
  const sent: boolean = await flush(fd, o)
  return sent ? 0 : 1
}

/**
 * Accepts one connection on `listen` and serves it until the peer leaves, a
 * Terminate, or a `die`; counts each statement in `board.seen`.
 */
export async function backend(listen: i32, board: Board): Promise<void> {
  const fd: i32 = await acceptOne(listen)
  if (fd < 0) {
    return
  }
  const w = new Wire()
  const o = new Out()
  const ready: boolean = await handshake(fd, w, o)
  if (ready) {
    while (true) {
      const done: i32 = await serveQuery(fd, w, o, board)
      board.seen += 1
      if (done !== 0) {
        break
      }
    }
  }
  netClose(fd)
}
