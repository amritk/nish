// The TechEmpower json and plaintext entry's server: one `Http1Server` pool
// and the handler for TFB's two tests, shared by `main.ts` and the verifier
// checks in tests/link/tfb_entry.
//
//   GET /json       {"message":"Hello, World!"}, application/json, written by
//                   a `JsonWriter` on every request: TFB forbids caching the
//                   serialization, and `serialized` counts the writes
//   GET /plaintext  Hello, World!, text/plain
//   anything else   404, `not found`, text/plain
//
// Every answer carries `Server`, and the module adds `Date` (one `HttpDate`
// for the pool, rewritten at most once a second) and `Content-Length`. A
// request the parser refuses is answered by the module, 400 with
// `Connection: close`. Pipelined requests are answered in order, a burst in one
// write.
import { pollAdd, pollModify } from "nish:net"
import {
  H1_DONE,
  H1_ERROR,
  H1_NEED_MORE,
  H1_POOL_FULL,
  H1_REQUEST,
  H1_WANT_READ,
  H1_WANT_WRITE,
  Http1Config,
  Http1Connection,
  Http1Server,
} from "nish/net/http1-server"
import { Http1Parser } from "nish/net/http1"
import { JsonWriter } from "nish/json"

/** The listener's token in the loop; a connection's token is its slot. */
export const TFB_LISTENER: i32 = -1
const ZERO: i32 = 0
/** Room for the JSON answer, which is 27 bytes. */
const JSON_ROOM: i32 = 64

const tfbBytes = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

export class TfbServer {
  server: Http1Server
  /** The readiness loop the program made, which the listener and every slot are added to. */
  loop: i32 = -1
  listener: i32 = -1
  textNames: u8[][]
  textValues: u8[][]
  jsonNames: u8[][]
  jsonValues: u8[][]
  plainBody: u8[]
  notFound: u8[]
  jsonBuf: u8[]
  writer: JsonWriter
  /** How many `/json` answers the writer has serialized. */
  serialized: i32 = 0
  /** How many requests have been answered by the handler, 404s included. */
  answered: i32 = 0

  /** A pool of `slots` serving on `listener`, which this adds to `loop`. */
  constructor(loop: i32, listener: i32, slots: i32) {
    this.loop = loop
    this.listener = listener
    this.server = new Http1Server(new Http1Config(), listener, slots)
    this.textNames = [tfbBytes("Server"), tfbBytes("Content-Type")]
    this.textValues = [tfbBytes("nish"), tfbBytes("text/plain")]
    this.jsonNames = [tfbBytes("Server"), tfbBytes("Content-Type")]
    this.jsonValues = [tfbBytes("nish"), tfbBytes("application/json")]
    this.plainBody = tfbBytes("Hello, World!")
    this.notFound = tfbBytes("not found")
    this.jsonBuf = new Array<u8>(JSON_ROOM)
    this.writer = new JsonWriter(this.jsonBuf, ZERO)
    pollAdd(loop, listener, H1_WANT_READ, TFB_LISTENER)
  }

  /** Answers one request from its head; a body, if any, is read and ignored. */
  answer(conn: Http1Connection): void {
    this.answered = this.answered + 1
    const p: Http1Parser = conn.parser
    const get: boolean = p.methodIs("GET")
    if (get && p.targetIs("/plaintext")) {
      this.reply(conn, 200, this.textNames, this.textValues, this.plainBody, toI32(this.plainBody.length))
    } else if (get && p.targetIs("/json")) {
      const w: JsonWriter = this.writer
      w.reset(this.jsonBuf, ZERO)
      w.beginObject()
      w.key("message")
      w.string("Hello, World!")
      w.endObject()
      this.serialized = this.serialized + 1
      this.reply(conn, 200, this.jsonNames, this.jsonValues, this.jsonBuf, w.end)
    } else {
      this.reply(conn, 404, this.textNames, this.textValues, this.notFound, toI32(this.notFound.length))
    }
  }

  reply(conn: Http1Connection, status: i32, names: u8[][], values: u8[][], body: u8[], length: i32): void {
    conn.respond(status, names, values, length)
    conn.write(body, ZERO, length)
    conn.end()
  }

  /**
   * One ready descriptor from the loop's `pollWait`: the listener accepts, a
   * slot is served. There is no pass arena (`using a = arena()`) around the
   * serve: NL2424 refuses one, since `Http1Server` stores into the slot's
   * parser and output, which outlive the pass. None is needed either: a slot
   * is built on its first accept and every later request reuses its buffers,
   * and this handler writes into buffers made once, so a warmed pass moves
   * `Arena.used()` by nothing — tests/link/tfb_entry pins it over 200 requests.
   */
  dispatch(token: i32, events: i32): void {
    if (token === TFB_LISTENER) {
      this.acceptAll()
    } else {
      this.serve(token, events)
    }
  }

  /** Accepts every waiting connection into the loop; a full pool closes the extra ones. */
  acceptAll(): void {
    while (true) {
      const slot: i32 = this.server.accept()
      if (slot >= 0) {
        pollAdd(this.loop, this.server.fd(slot), H1_WANT_READ, slot)
      } else if (slot !== H1_POOL_FULL) {
        return
      }
    }
  }

  /** A slot's descriptor is ready: reads or writes it, answers its requests, then re-arms or closes it. */
  serve(slot: i32, events: i32): void {
    if (!this.server.holds(slot)) {
      return
    }
    let wants: i32 = (events & 5) !== 0 ? this.server.readable(slot) : this.server.writable(slot)
    const conn: Http1Connection = this.server.connection(slot)
    let event: i32 = this.server.next(slot)
    while (event !== H1_NEED_MORE && event !== H1_ERROR) {
      if (event === H1_REQUEST) {
        this.answer(conn)
      }
      event = this.server.next(slot)
    }
    wants = this.server.flush(slot)
    if ((wants & H1_DONE) !== 0) {
      this.server.close(slot)
      return
    }
    if (this.server.rearm(slot, wants)) {
      pollModify(this.loop, this.server.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot)
    }
  }
}
