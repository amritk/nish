// The notes API of `examples/http-app`: its configuration, its routes and how
// it answers each one, apart from `main` so that `tests/link/net_http_app`
// drives the same code over loopback.
import { JsonWriter, jsonField } from "nish/json"
import { HttpHandler, HandlerLimits, HttpRequest } from "nish/net/handler"
import { http1Text } from "nish/net/http1"
import { ROUTER_METHOD_NOT_ALLOWED, Router, RouterLimits } from "nish/net/router"
import { Notes } from "./notes"

// The routes, in the order they are added.
const HEALTH: i32 = 0
const LIST: i32 = 1
const CREATE: i32 = 2
const SHOW: i32 = 3
const REMOVE: i32 = 4

// The statuses it answers.
const OK: i32 = 200
const CREATED: i32 = 201
const NO_CONTENT: i32 = 204
const BAD_REQUEST: i32 = 400
const NOT_FOUND: i32 = 404
const METHOD_NOT_ALLOWED: i32 = 405
const INSUFFICIENT_STORAGE: i32 = 507

const ZERO: i32 = 0

/** What the command line set. */
export class Config {
  port: i32 = -1
  maxNotes: i32 = 1000
  drainMs: i32 = 5000
  quiet: boolean = false
  error: string = ""
}

/** `text` as a non-negative decimal, or -1. */
const decimal = (text: string): i32 => {
  if (text.length === 0 || text.length > 9) {
    return -1
  }
  let value: i32 = 0
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    const c: i32 = toI32(text.charCodeAt(k))
    if (c < 48 || c > 57) {
      return -1
    }
    value = value * 10 + (c - 48)
  }
  return value
}

export const configure = (args: string[]): Config => {
  const config = new Config()
  let k: i32 = 1
  while (k < toI32(args.length) && config.error === "") {
    const arg: string = args[k]
    if (arg === "--quiet") {
      config.quiet = true
    } else if (arg === "--max-notes" || arg === "--drain-ms") {
      const value: i32 = k + 1 < toI32(args.length) ? decimal(args[k + 1]) : -1
      if (value < 0) {
        config.error = `${arg} takes a number`
      } else if (arg === "--max-notes") {
        config.maxNotes = value
      } else {
        config.drainMs = value
      }
      k += 1
    } else if (config.port < 0 && decimal(arg) > 0 && decimal(arg) < 65536) {
      config.port = decimal(arg)
    } else {
      config.error = `unexpected argument: ${arg}`
    }
    k += 1
  }
  if (config.error === "" && config.port < 0) {
    config.error = "a port is required"
  }
  return config
}

/** `{"id":…,"text":…}` into `w`. */
const writeNote = (w: JsonWriter, id: i32, text: string): void => {
  w.beginObject()
  w.key("id")
  w.i32(id)
  w.key("text")
  w.string(text)
  w.endObject()
}

/** The API: its notes, its handler and how it logs. */
export class App {
  h: HttpHandler
  notes: Notes
  quiet: boolean = false

  constructor(h: HttpHandler, config: Config) {
    this.h = h
    this.notes = new Notes(config.maxNotes)
    this.quiet = config.quiet
  }

  /** Answers `req` and logs it. */
  answer(req: HttpRequest): void {
    let line: string = ""
    if (!this.quiet) {
      // Read before the answer, which hands `req` back to the handler.
      line = `${http1Text(req.head, req.methodStart, req.methodEnd, false)} ${http1Text(req.head, req.targetStart, req.targetEnd, false)}`
    }
    const status: i32 = this.dispatch(req)
    if (!this.quiet) {
      console.log(`${line} ${status}`)
    }
  }

  /** Answers `req`; answers the status it sent. */
  dispatch(req: HttpRequest): i32 {
    const h: HttpHandler = this.h
    switch (req.route) {
      case HEALTH: {
        const w = h.json()
        w.beginObject()
        w.key("status")
        w.string("ok")
        w.key("notes")
        w.i32(this.notes.count())
        w.endObject()
        h.sendJson(req, OK)
        return OK
      }
      case LIST: {
        const w = h.json()
        w.beginArray()
        for (let k: i32 = 0; k < this.notes.count() && k < toI32(this.notes.texts.length); k++) {
          writeNote(w, this.notes.ids[k], this.notes.texts[k])
        }
        w.endArray()
        h.sendJson(req, OK)
        return OK
      }
      case CREATE: {
        const text: string | null = jsonField(String.fromBytes(req.body, ZERO, req.bodyLength), "text")
        if (text === null) {
          h.problem(req, BAD_REQUEST, "Bad Request", "the body is a JSON object with a string field \"text\"")
          return BAD_REQUEST
        }
        const id: i32 = this.notes.add(text)
        if (id < 0) {
          h.problem(req, INSUFFICIENT_STORAGE, "Insufficient Storage", `the store holds ${this.notes.capacity} notes`)
          return INSUFFICIENT_STORAGE
        }
        writeNote(h.json(), id, text)
        h.sendJson(req, CREATED)
        return CREATED
      }
      case SHOW: {
        const at: i32 = this.notes.find(req.paramDecimal(ZERO))
        if (at < 0 || at >= toI32(this.notes.texts.length)) {
          h.problem(req, NOT_FOUND, "Not Found", "there is no note with that id")
          return NOT_FOUND
        }
        writeNote(h.json(), this.notes.ids[at], this.notes.texts[at])
        h.sendJson(req, OK)
        return OK
      }
      case REMOVE:
        if (!this.notes.remove(req.paramDecimal(ZERO))) {
          h.problem(req, NOT_FOUND, "Not Found", "there is no note with that id")
          return NOT_FOUND
        }
        h.empty(req, NO_CONTENT)
        return NO_CONTENT
      default: {
        // NOT_FOUND, or METHOD_NOT_ALLOWED with the `Allow` of the methods the path takes.
        const status: i32 = req.route === ROUTER_METHOD_NOT_ALLOWED ? METHOD_NOT_ALLOWED : NOT_FOUND
        h.refuse(req)
        return status
      }
    }
  }
}

/** Turns the handler once and answers every whole request it made. */
export const serveTurn = (app: App, timeoutMs: i32): void => {
  app.h.wait(timeoutMs)
  while (app.h.ready()) {
    app.answer(app.h.take())
  }
}

/** The API's routes, added in the order of their constants. */
export const appRoutes = (): Router => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/health")
  router.add("GET", "/notes")
  router.add("POST", "/notes")
  router.add("GET", "/notes/:id")
  router.add("DELETE", "/notes/:id")
  return router
}
