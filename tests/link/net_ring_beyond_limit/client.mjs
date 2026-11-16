// The other end of the `net_ring` checks in tests/run.js. It starts a ring
// server under `ulimit -n <limit>`, reads the `port N` line the server prints,
// and opens <count> connections to that port from this process, which has no
// such limit. In `echo` mode each connection sends five bytes, waits for them
// to come back, and ends once all have. In `hold` mode the connections send
// nothing and stay open until the server exits. In `flood` mode one
// connection writes 64 MiB as fast as the kernel takes them; when no write
// has drained for a second it prints `flood: N bytes before the stall` and
// opens a second connection as its signal, then writes the rest and ends the
// first. In `sink` mode one connection reads nothing for a second, then reads
// to the server's 64 MiB, prints `sink: received N bytes` and ends. The
// client exits with the
// server's status, after printing the server's output, so the verdict is the
// server's exit status. A failure of the client's own exits 1.
//
//     node client.mjs <exe> <limit> <count> echo|hold|flood|sink
import { spawn } from "node:child_process"
import net from "node:net"

const [exe, limit, countText, mode] = process.argv.slice(2)
const count = Number(countText)
const server = spawn("bash", ["-c", `ulimit -n ${Number(limit)} && exec "$0"`, exe], {
  stdio: ["ignore", "pipe", "inherit"],
})
let out = ""
const sockets = []
let echoed = 0
const done = (status, why) => {
  if (why) {
    process.stdout.write(`client: ${why}\n`)
  }
  process.stdout.write(out)
  process.exit(status)
}
const timer = setTimeout(() => {
  server.kill("SIGKILL")
  done(1, `timed out with ${sockets.length} connected and ${echoed} echoed`)
}, 120_000)

const FLOOD = 64 * 1024 * 1024
const flood = (port) => {
  const s = net.connect({ host: "127.0.0.1", port })
  sockets.push(s)
  s.on("error", (e) => done(1, `the flooding connection: ${e.message}`))
  const chunk = Buffer.alloc(65536, 0x61)
  let queued = 0
  let stalled = false
  let stall = null
  const signal = () => {
    stalled = true
    out = `flood: ${s.bytesWritten - s.writableLength} bytes before the stall\n${out}`
    sockets.push(net.connect({ host: "127.0.0.1", port }))
  }
  const pump = () => {
    clearTimeout(stall)
    while (queued < FLOOD) {
      queued += chunk.length
      if (!s.write(chunk)) {
        if (!stalled) {
          stall = setTimeout(signal, 1000)
        }
        s.once("drain", pump)
        return
      }
    }
    if (!stalled) {
      signal()
    }
    s.end()
  }
  s.on("connect", pump)
}

const sink = (port) => {
  const s = net.connect({ host: "127.0.0.1", port })
  sockets.push(s)
  s.on("error", (e) => done(1, `the sink connection: ${e.message}`))
  s.pause()
  let got = 0
  s.on("data", (d) => {
    got += d.length
    if (got >= FLOOD) {
      out = `sink: received ${got} bytes\n${out}`
      s.end()
    }
  })
  s.on("connect", () => setTimeout(() => s.resume(), 1000))
}

const open = (port) => {
  if (mode === "flood") {
    flood(port)
    return
  }
  if (mode === "sink") {
    sink(port)
    return
  }
  for (let k = 0; k < count; k++) {
    const s = net.connect({ host: "127.0.0.1", port })
    sockets.push(s)
    s.on("error", (e) => {
      if (mode === "echo") {
        done(1, `connection ${k}: ${e.message}`)
      }
    })
    if (mode !== "echo") {
      continue
    }
    let got = 0
    s.on("connect", () => s.write("ping\n"))
    s.on("data", (d) => {
      got += d.length
      if (got === 5) {
        echoed += 1
        if (echoed === count) {
          for (const t of sockets) {
            t.end()
          }
        }
      }
    })
  }
}

server.stdout.setEncoding("utf8")
let opened = false
server.stdout.on("data", (d) => {
  out += d
  const port = opened ? null : /^port (\d+)\n/.exec(out)
  if (port) {
    opened = true
    open(Number(port[1]))
  }
})
server.on("exit", (code, signal) => {
  clearTimeout(timer)
  for (const s of sockets) {
    s.destroy()
  }
  done(code ?? 1, signal ? `the server died of ${signal}` : "")
})
