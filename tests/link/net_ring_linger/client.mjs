// The other end of "net_ring: Http1Server's lingering close on a ring
// listener ..." in tests/run.js. It starts `linger.ts`'s program, reads the
// `port N` line it prints, sends a request line Http1Server refuses, then
// 1 KiB every 10 ms until it reads the end of the stream, and only then ends
// its own writing side. It passes, exit 0, when it read a whole 400
// response and then the end of the stream within 100 sends, a second, well
// inside `lingerTimeout`'s 2, so the server shut its write side while the
// client was still sending rather than closing once the client stopped; saw
// no error on the connection; and the server exited 0. A server that exits 2
// (rings refused) is passed through as 2; anything else exits 1.
//
//     node client.mjs <exe>
import { spawn } from "node:child_process"
import net from "node:net"

const [exe] = process.argv.slice(2)
/** Sends past this many, 10 ms apart, with no end of the stream fail. */
const LIMIT = 100
const server = spawn(exe, [], { stdio: ["ignore", "pipe", "inherit"] })
let out = ""
let got = Buffer.alloc(0)
let ended = false
let sent = 0
let error = null
let serverDone = null
const done = (status, why) => {
  process.stdout.write(`${why ? `client: ${why}\n` : ""}${out}`)
  process.exit(status)
}
const timer = setTimeout(() => {
  server.kill("SIGKILL")
  done(1, `timed out: ended ${ended}, error ${error}, ${got.length} bytes`)
}, 30_000)

const verdict = () => {
  if (serverDone === null || (serverDone === 0 && !ended && error === null)) {
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
    done(1, `the connection failed: ${error} after ${got.length} bytes`)
  }
  if (sent >= LIMIT) {
    done(1, `no end of the stream within ${LIMIT} sends`)
  }
  if (!text.startsWith("HTTP/1.1 400") || !whole) {
    done(1, `not a whole 400 response: ${JSON.stringify(text.slice(0, 200))}`)
  }
  done(0, `linger: read a ${got.length}-byte 400 and the end of the stream`)
}

server.stdout.on("data", (d) => {
  const first = out === ""
  out += d
  const m = /^port (\d+)$/m.exec(out)
  if (!first || m === null) {
    return
  }
  const s = net.connect({ host: "127.0.0.1", port: Number(m[1]) })
  s.on("data", (d) => {
    got = Buffer.concat([got, d])
  })
  s.on("end", () => {
    ended = true
    s.end()
    verdict()
  })
  s.on("error", (e) => {
    error = e.code ?? e.message
    verdict()
  })
  s.on("connect", () => {
    s.write("NOT A REQUEST LINE\r\n\r\n")
    const chunk = Buffer.alloc(1024, 0x61)
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
