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
// write. A burst deeper than the output holds leaves the slot owing a reply:
// `respond` or `write` answers `H1_AGAIN`, the slot remembers which body it
// owes and how much of it is written, and `H1_WRITE` resumes it once the
// socket has drained.
import { pollAdd, pollModify } from "nish:net"
import {
  H1_DONE,
  H1_AGAIN,
  H1_ERROR,
  H1_NEED_MORE,
  H1_POOL_FULL,
  H1_REQUEST,
  H1_WANT_READ,
  H1_WANT_WRITE,
  H1_WRITE,
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
/** What a slot owes: nothing, or the reply with one of the bodies below. */
const OWES_NOTHING: i32 = 0
const OWES_PLAIN: i32 = 1
const OWES_JSON: i32 = 2
const OWES_NOT_FOUND: i32 = 3
/** The body offset of a reply whose head is not written yet. */
const HEAD_OWED: i32 = -1
/** `tcpAccept`'s failures that a closed connection cures: EMFILE and ENFILE. */
const OUT_OF_FILES: i32 = -24
const SYSTEM_OUT_OF_FILES: i32 = -23
/** How long a loop with a paused listener waits before trying it again, in milliseconds. */
const PAUSE_MS: i32 = 50

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
  /** Per slot: the `OWES_` reply it has not finished writing. */
  owes: i32[]
  /** Per slot: how much of the owed body is written, or `HEAD_OWED`. */
  owedAt: i32[]
  /** Per slot: the owed body's length. */
  owedLength: i32[]
  /** Whether the listener is out of the loop, after EMFILE or ENFILE, until a connection closes or `PAUSE_MS` pass. */
  paused: boolean = false

  /** A pool of `slots`, at least one as `Http1Server` makes it, serving on `listener`, which this adds to `loop`. */
  constructor(loop: i32, listener: i32, size: i32) {
    const slots: i32 = size < 1 ? 1 : size
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
    this.owes = new Array<i32>(slots)
    this.owedAt = new Array<i32>(slots)
    this.owedLength = new Array<i32>(slots)
    pollAdd(loop, listener, H1_WANT_READ, TFB_LISTENER)
  }

  /** Answers the request whose head `slot` has just read; a body, if any, is read and ignored. */
  answer(slot: i32, conn: Http1Connection): void {
    this.answered = this.answered + 1
    const p: Http1Parser = conn.parser
    const get: boolean = p.methodIs("GET")
    let owes: i32 = OWES_NOT_FOUND
    let length: i32 = toI32(this.notFound.length)
    if (get && p.targetIs("/plaintext")) {
      owes = OWES_PLAIN
      length = toI32(this.plainBody.length)
    } else if (get && p.targetIs("/json")) {
      const w: JsonWriter = this.writer
      w.reset(this.jsonBuf, ZERO)
      w.beginObject()
      w.key("message")
      w.string("Hello, World!")
      w.endObject()
      this.serialized = this.serialized + 1
      owes = OWES_JSON
      length = w.end
    }
    if (this.tracks(slot)) {
      this.owes[slot] = owes
      this.owedAt[slot] = HEAD_OWED
      this.owedLength[slot] = length
      this.resume(slot, conn)
    }
  }

  /** Whether `slot` is one the owed-reply arrays have a place for. */
  tracks(slot: i32): boolean {
    return (
      slot >= 0 &&
      slot < toI32(this.owes.length) &&
      slot < toI32(this.owedAt.length) &&
      slot < toI32(this.owedLength.length)
    )
  }

  /** The body of an `OWES_` reply. */
  body(owes: i32): u8[] {
    if (owes === OWES_JSON) {
      return this.jsonBuf
    }
    return owes === OWES_PLAIN ? this.plainBody : this.notFound
  }

  /**
   * Writes what `slot` owes, as far as the output takes it. Every body is the
   * same bytes on every request, so a reply held back by a full output
   * resumes from `jsonBuf` even when other slots have rewritten it since.
   */
  resume(slot: i32, conn: Http1Connection): void {
    if (!this.tracks(slot)) {
      return
    }
    const owes: i32 = this.owes[slot]
    if (owes === OWES_NOTHING) {
      return
    }
    const json: boolean = owes === OWES_JSON
    const names: u8[][] = json ? this.jsonNames : this.textNames
    const values: u8[][] = json ? this.jsonValues : this.textValues
    const body: u8[] = this.body(owes)
    const length: i32 = this.owedLength[slot]
    let at: i32 = this.owedAt[slot]
    if (at === HEAD_OWED) {
      const r: i32 = conn.respond(owes === OWES_NOT_FOUND ? 404 : 200, names, values, length)
      if (r === H1_AGAIN) {
        return
      }
      at = r === 0 ? 0 : length
    }
    while (at < length) {
      const n: i32 = conn.write(body, at, length - at)
      if (n === H1_AGAIN) {
        this.owedAt[slot] = at
        return
      }
      at = n > 0 ? at + n : length
    }
    this.owes[slot] = OWES_NOTHING
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

  /**
   * Accepts every waiting connection into the loop; a full pool closes the
   * extra ones. Out of descriptors (EMFILE or ENFILE), the waiting connection
   * stays queued and the listener stays readable, so a level-triggered loop
   * would spin on it: the listener leaves the loop until a slot closes or the
   * loop's next wait, which `waitMs` bounds, ends.
   */
  acceptAll(): void {
    while (true) {
      const slot: i32 = this.server.accept()
      if (slot >= 0) {
        pollAdd(this.loop, this.server.fd(slot), H1_WANT_READ, slot)
      } else if (slot === OUT_OF_FILES || slot === SYSTEM_OUT_OF_FILES) {
        this.pause()
        return
      } else if (slot !== H1_POOL_FULL) {
        return
      }
    }
  }

  /** Takes the listener out of the loop until `unpause` puts it back. */
  pause(): void {
    pollModify(this.loop, this.listener, ZERO, TFB_LISTENER)
    this.paused = true
  }

  /** Puts a paused listener back in the loop; a listener still out of descriptors pauses again on its next accept. */
  unpause(): void {
    if (this.paused) {
      this.paused = false
      pollModify(this.loop, this.listener, H1_WANT_READ, TFB_LISTENER)
    }
  }

  /** The timeout for the loop's next `pollWait`: none, or `PAUSE_MS` while the listener is paused. */
  waitMs(): i32 {
    return this.paused ? PAUSE_MS : -1
  }

  /** Closes `slot`, and puts a listener paused for want of descriptors back in the loop. */
  close(slot: i32): void {
    this.server.close(slot)
    this.unpause()
  }

  /** A slot's descriptor is ready: reads or writes it, answers its requests, then re-arms or closes it. */
  serve(slot: i32, events: i32): void {
    if (!this.server.holds(slot)) {
      return
    }
    if ((events & 5) !== 0) {
      this.server.readable(slot)
    } else {
      this.server.writable(slot)
    }
    const conn: Http1Connection = this.server.connection(slot)
    let event: i32 = this.server.next(slot)
    while (event !== H1_NEED_MORE && event !== H1_ERROR) {
      if (event === H1_REQUEST) {
        this.answer(slot, conn)
      } else if (event === H1_WRITE) {
        this.resume(slot, conn)
      }
      event = this.server.next(slot)
    }
    const wants: i32 = this.server.flush(slot)
    if ((wants & H1_DONE) !== 0) {
      this.close(slot)
      return
    }
    if (this.server.rearm(slot, wants)) {
      pollModify(this.loop, this.server.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot)
    }
  }
}
