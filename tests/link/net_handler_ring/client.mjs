// The other end of tests/run.js's `net_handler_ring` section. It
// starts `ring.ts`'s binary under `ulimit -n <limit>`, reads the `port N` line
// it prints, and opens <count> connections to that port from this process,
// which has no such limit. Each sends one `GET /` and stays open. When the
// server prints `full`, the first connection that has its answer ends. The
// client exits with the server's status, after printing the server's output,
// so the verdict is the server's exit status. A failure of the client's own
// exits 1.
//
//     node client.mjs <exe> <limit> <count>
import { spawn } from "node:child_process"
import net from "node:net"

const [exe, limit, countText] = process.argv.slice(2)
const count = Number(countText)
const server = spawn("bash", ["-c", `ulimit -n ${Number(limit)} && exec "$0"`, exe], {
  stdio: ["ignore", "pipe", "inherit"],
})
let out = ""
const sockets = []
const answered = new Set()
const done = (status, why) => {
  if (why) {
    process.stdout.write(`client: ${why}\n`)
  }
  process.stdout.write(out)
  process.exit(status)
}
const timer = setTimeout(() => {
  server.kill("SIGKILL")
  done(1, `timed out with ${sockets.length} connected and ${answered.size} answered`)
}, 120_000)

const open = (port) => {
  for (let k = 0; k < count; k++) {
    const s = net.connect({ host: "127.0.0.1", port })
    sockets.push(s)
    s.on("error", () => {})
    s.on("connect", () => s.write("GET / HTTP/1.1\r\nHost: t\r\n\r\n"))
    s.on("data", (d) => {
      if (d.toString("latin1").startsWith("HTTP/1.1 200")) {
        answered.add(s)
      }
    })
  }
}

let state = 0
server.stdout.setEncoding("utf8")
server.stdout.on("data", (d) => {
  out += d
  const port = state === 0 ? /^port (\d+)\n/.exec(out) : null
  if (port) {
    state = 1
    open(Number(port[1]))
  }
  if (state === 1 && /\nfull\n/.test(out)) {
    state = 2
    const first = sockets.find((s) => answered.has(s))
    if (first === undefined) {
      server.kill("SIGKILL")
      done(1, "no connection was answered")
    }
    first.end()
  }
})
server.on("exit", (code, signal) => {
  clearTimeout(timer)
  for (const s of sockets) {
    s.destroy()
  }
  done(code ?? 1, signal ? `the server died of ${signal}` : "")
})
