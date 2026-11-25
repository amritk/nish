// The HttpArena entry's `/async-db` route: a stub that answers no rows until
// the database side is written.
import { HttpServer, HttpServerRequest } from "nish/net/http-server"

/** The JSON a failed or empty query answers. */
const EMPTY: string = `{"items":[],"count":0}`

/** One worker's database side. */
export class ArenaDb {
  empty: u8[]
  jsonType: u8[]

  constructor(url: string | null, maxConn: string | null, workers: i32) {
    this.empty = new Array<u8>(EMPTY.length)
    for (let k: i32 = 0; k < toI32(EMPTY.length); k++) {
      this.empty[k] = toU8(EMPTY.charCodeAt(k))
    }
    this.jsonType = new Array<u8>(16)
    const t: string = "application/json"
    for (let k: i32 = 0; k < 16; k++) {
      this.jsonType[k] = toU8(t.charCodeAt(k))
    }
  }

  /** Watches the connections' sockets on `h`. */
  attach(h: HttpServer): void {}

  /** The longest the loop may block for the database's sake, or -1. */
  waitMs(): i32 {
    return -1
  }

  /** Moves every connection whose socket fired. */
  turn(h: HttpServer): void {}

  /** Answers `/async-db?min&max&limit` on `r`. */
  query(h: HttpServer, r: HttpServerRequest, min: i64, max: i64, limit: i64): void {
    h.send(r, 200, this.jsonType, this.empty, 0, toI32(this.empty.length))
  }
}
