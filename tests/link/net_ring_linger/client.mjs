// The other end of "net_ring: Http1Server's lingering close on a ring
// listener ..." in tests/run.js. It starts `linger.ts`'s program, reads the
// `port N` line it prints, sends a request line Http1Server refuses, then
// 1 KiB every 10 ms until it reads the end of the stream. It keeps writing
// after that: TAIL more sends, 20 ms apart, then a wait, and only then ends
// its own writing side. A server that lingers has shut only its write side
// and still reads, so the tail is taken; a server that closed answers the
// first byte after its close with a reset, whatever the timing before it.
// It passes, exit 0, when it read a whole 400 response and then the end of
// the stream within 100 sends, a second, well inside `lingerTimeout`'s 2;
// saw no error on the connection through the tail; and the server exited 0.
// A server that exits 2 (rings refused) is passed through as 2; anything
// else exits 1.
//
//     node client.mjs <exe>
import { spawn } from "node:child_process"
import net from "node:net"

const [exe] = process.argv.slice(2)
/** Sends past this many, 10 ms apart, with no end of the stream fail. */
const LIMIT = 100
/** Sends after the end of the stream, which only a lingering server takes. */
const TAIL = 5
/** How long after the last tail send a reset has to arrive, in ms. */
const SETTLE = 200
const server = spawn(exe, [], { stdio: ["ignore", "pipe", "inherit"] })
let out = ""
let got = Buffer.alloc(0)
let ended = false
let tailDone = false
let sent = 0
let error = null
let serverDone = null
const done = (status, why) => {
  process.stdout.write(`${why ? `client: ${why}\n` : ""}${out}`)
  process.exit(status)
}
const timer = setTimeout(() => {
  server.kill("SIGKILL")
  done(1, `timed out: ended ${ended}, tail ${tailDone}, error ${error}, ${got.length} bytes`)
}, 30_000)

const verdict = () => {
  if (serverDone === null || (serverDone === 0 && !tailDone && error === null)) {
    return
  }
  clearTimeout(timer)
  if (serverDone !== 0) {
    done(serverDone === 2 ? 2 : 1, `the server exited ${serverDone}`)
  }
  const text = got.toString("latin1")
  const head = text.indexOf("\r\n\r\n")
  const m = /\r\ncontent-length: *(\d+)/i.exec(text)
  const whole = head >= 0 && m !== null && got.length === head + 4 + Number(m[1])
  if (error !== null) {
    done(1, `the connection failed: ${error} after ${got.length} bytes, end of the stream ${ended}`)
  }
  if (sent >= LIMIT) {
    done(1, `no end of the stream within ${LIMIT} sends`)
  }
  if (!text.startsWith("HTTP/1.1 400") || !whole) {
    done(1, `not a whole 400 response: ${JSON.stringify(text.slice(0, 200))}`)
  }
  done(0, `linger: read a ${got.length}-byte 400 and the end of the stream, and the server took ${TAIL} sends after it`)
}

server.stdout.on("data", (d) => {
  const first = out === ""
  out += d
  const m = /^port (\d+)$/m.exec(out)
  if (!first || m === null) {
    return
  }
  const s = net.connect({ host: "127.0.0.1", port: Number(m[1]) })
  const chunk = Buffer.alloc(1024, 0x61)
  s.on("data", (d) => {
    got = Buffer.concat([got, d])
  })
  s.on("end", () => {
    ended = true
    let tail = 0
    const more = setInterval(() => {
      if (error !== null) {
        clearInterval(more)
        return
      }
      if (tail === TAIL) {
        clearInterval(more)
        setTimeout(() => {
          tailDone = true
          if (error === null) {
            s.end()
          }
          verdict()
        }, SETTLE)
        return
      }
      tail++
      s.write(chunk)
    }, 20)
  })
  s.on("error", (e) => {
    error = e.code ?? e.message
    verdict()
  })
  s.on("connect", () => {
    s.write("NOT A REQUEST LINE\r\n\r\n")
    const more = setInterval(() => {
      if (ended || error !== null) {
        clearInterval(more)
        return
      }
      if (sent >= LIMIT) {
        clearInterval(more)
        s.end()
        return
      }
      sent++
      s.write(chunk)
    }, 10)
  })
})
server.on("exit", (code, signal) => {
  serverDone = code ?? 128 + (signal ? 1 : 0)
  verdict()
})
