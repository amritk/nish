// The notes API of `examples/http-app`: its configuration, its routes and how
// it answers each one, apart from `main` so that `tests/link/net_http_app`
// drives the same code over loopback. With `--static <dir>` it also serves the
// files under `dir` at `/static/`, through `nish/net/static`.
import { JsonWriter, jsonField } from "nish/json"
import { HttpHandler, HttpRequest } from "nish/net/handler"
import { http1Text } from "nish/net/http1-codec"
import { ROUTER_METHOD_NOT_ALLOWED, Router, RouterLimits } from "nish/net/router"
import { STATIC_NOT_FOUND, StaticFiles, StaticLimits } from "nish/net/static"
import { Notes } from "./notes"

// The routes, in the order they are added.
const HEALTH: i32 = 0
const LIST: i32 = 1
const CREATE: i32 = 2
const SHOW: i32 = 3
const REMOVE: i32 = 4
const FILES: i32 = 5

// The statuses it answers.
const OK: i32 = 200
const CREATED: i32 = 201
const NO_CONTENT: i32 = 204
const BAD_REQUEST: i32 = 400
const NOT_FOUND: i32 = 404
const METHOD_NOT_ALLOWED: i32 = 405
const INTERNAL_SERVER_ERROR: i32 = 500
const INSUFFICIENT_STORAGE: i32 = 507

const ZERO: i32 = 0

/** What the command line set. */
export class Config {
  port: i32 = -1
  maxNotes: i32 = 1000
  drainMs: i32 = 5000
  quiet: boolean = false
  /** The directory `--static` serves at `/static/`, or `""` for none. */
  staticDir: string = ""
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
    // Nine digits at most, so `value` never passes 99999999 before the last
    // one: the second test never holds, and bounds the step below.
    if (c < 48 || c > 57 || value < 0 || value > 99999999) {
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
    } else if (arg === "--static") {
      if (k + 1 < toI32(args.length) && args[k + 1] !== "") {
        config.staticDir = args[k + 1]
      } else {
        config.error = "--static takes a directory"
      }
      k += 1
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
    // The loop's own test would end it here anyway; this one bounds the step.
    if (k >= toI32(args.length) - 1) {
      break
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

/**
 * Logs an answer the handler refused for a broken contract — a request
 * answered twice, a status out of range — which this program's own code
 * would have to have made, and answers `req` with a bare 500 instead. The
 * handler leaves a refused request as it was, so the 500 answers it unless
 * it was answered already; that refusal is logged too, and then nothing of
 * `req` is left to answer.
 */
const logRefusal = (h: HttpHandler, req: HttpRequest, sent: Result<i32, string>): void => {
  if (sent.isOk()) {
    return
  }
  console.error(`http-app: ${sent.error}`)
  const fallback: Result<i32, string> = h.tryEmpty(req, INTERNAL_SERVER_ERROR)
  if (fallback.isErr()) {
    console.error(`http-app: ${fallback.error}`)
  }
}

/**
 * Logs `error`, a route parameter the route table does not give, and answers
 * 500: the table is this program's, so the fault is the server's.
 */
const routeFault = (h: HttpHandler, req: HttpRequest, error: string): i32 => {
  logRefusal(h, req, Err(error))
  return INTERNAL_SERVER_ERROR
}

/** The API: its notes, its handler and how it logs. */
export class App {
  h: HttpHandler
  notes: Notes
  quiet: boolean = false
  /** What `--static` serves, or null without it. */
  files: StaticFiles | null = null

  constructor(h: HttpHandler, config: Config) {
    this.h = h
    this.notes = new Notes(config.maxNotes)
    this.quiet = config.quiet
    if (config.staticDir !== "") {
      this.files = new StaticFiles(config.staticDir, new StaticLimits())
    }
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
        logRefusal(h, req, h.trySendJson(req, OK))
        return OK
      }
      case LIST: {
        const w = h.json()
        w.beginArray()
        for (let k: i32 = 0; k < toI32(this.notes.ids.length) && k < toI32(this.notes.texts.length); k++) {
          writeNote(w, this.notes.ids[k], this.notes.texts[k])
        }
        w.endArray()
        logRefusal(h, req, h.trySendJson(req, OK))
        return OK
      }
      case CREATE: {
        const text: string | null = jsonField(String.fromBytes(req.body, ZERO, req.bodyLength), "text")
        if (text === null) {
          logRefusal(
            h,
            req,
            h.tryProblem(
              req,
              BAD_REQUEST,
              "Bad Request",
              'the body is a JSON object with a string field "text"'
            )
          )
          return BAD_REQUEST
        }
        const id: i32 = this.notes.add(text)
        if (id < 0) {
          logRefusal(
            h,
            req,
            h.tryProblem(
              req,
              INSUFFICIENT_STORAGE,
              "Insufficient Storage",
              `the store holds ${this.notes.capacity} notes`
            )
          )
          return INSUFFICIENT_STORAGE
        }
        writeNote(h.json(), id, text)
        logRefusal(h, req, h.trySendJson(req, CREATED))
        return CREATED
      }
      case SHOW: {
        // The route `/notes/:id` has its one parameter, so it is no `Err`; a
        // parameter that is not a decimal is -1, an id no note has.
        const id: Result<i32, string> = req.tryParamDecimal(ZERO)
        if (id.isErr()) {
          return routeFault(h, req, id.error)
        }
        const at: i32 = this.notes.find(id.value)
        if (at < 0 || at >= toI32(this.notes.ids.length) || at >= toI32(this.notes.texts.length)) {
          logRefusal(h, req, h.tryProblem(req, NOT_FOUND, "Not Found", "there is no note with that id"))
          return NOT_FOUND
        }
        writeNote(h.json(), this.notes.ids[at], this.notes.texts[at])
        logRefusal(h, req, h.trySendJson(req, OK))
        return OK
      }
      case REMOVE: {
        const id: Result<i32, string> = req.tryParamDecimal(ZERO)
        if (id.isErr()) {
          return routeFault(h, req, id.error)
        }
        if (!this.notes.remove(id.value)) {
          logRefusal(h, req, h.tryProblem(req, NOT_FOUND, "Not Found", "there is no note with that id"))
          return NOT_FOUND
        }
        logRefusal(h, req, h.tryEmpty(req, NO_CONTENT))
        return NO_CONTENT
      }
      case FILES: {
        const files: StaticFiles | null = this.files
        // The route `/static/*` has its one parameter, so neither is an `Err`.
        const start: Result<i32, string> = req.tryParamStart(ZERO)
        if (start.isErr()) {
          return routeFault(h, req, start.error)
        }
        const end: Result<i32, string> = req.tryParamEnd(ZERO)
        if (end.isErr()) {
          return routeFault(h, req, end.error)
        }
        // A path it refuses, a file that is not there, or no `--static`: 404.
        if (files !== null) {
          const served: Result<i32, string> = files.tryServeHandler(h, req, start.value, end.value)
          if (served.isErr()) {
            logRefusal(h, req, served)
            return INTERNAL_SERVER_ERROR
          }
          if (served.value !== STATIC_NOT_FOUND) {
            return files.status
          }
        }
        logRefusal(h, req, h.tryRefuse(req))
        return NOT_FOUND
      }
      default: {
        // NOT_FOUND, or METHOD_NOT_ALLOWED with the `Allow` of the methods the path takes.
        const status: i32 = req.route === ROUTER_METHOD_NOT_ALLOWED ? METHOD_NOT_ALLOWED : NOT_FOUND
        logRefusal(h, req, h.tryRefuse(req))
        return status
      }
    }
  }
}

/** Turns the handler once and answers every whole request it made. */
export const serveTurn = (app: App, timeoutMs: i32): void => {
  app.h.wait(timeoutMs)
  let req: HttpRequest | null = app.h.next()
  while (req !== null) {
    app.answer(req)
    req = app.h.next()
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
  router.add("GET", "/static/*")
  return router
}
