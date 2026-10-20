#!/usr/bin/env node
// What the interop server's connection pools cost to start: resident memory
// and the time from exec until every port answers, for each `--slots` count.
//
//   node bench/pool-rss.mjs --bin build/interop --slots 16,64,256,1024
//   node bench/pool-rss.mjs --bin build/interop --slots 64 --per-pool --runs 5
//
// The server (`tests/link/net_interop_server`, built with
// `build/nish tests/link/net_interop_server/main.ts -o build/interop.ir/ --link build/interop`)
// builds every pool before it prints its `ports` line, so that line is when
// the cost is paid; the script then connects to each TCP port and sends the
// QUIC port a packet of an unknown version, which only the running loop
// answers (with Version Negotiation), and reads `VmRSS` and `VmHWM` from
// `/proc/<pid>/status` before it kills the server.
//
// A count that does not listen within `--timeout` seconds is reported as a
// timeout, and one whose resident memory passes `--cap` MB (three quarters of
// the memory free when that run starts, by default) is killed and reported as
// out of memory, so a count too large for the machine ends the row instead of
// the container. One killed by SIGKILL before it listens is reported as a
// possible OOM kill: the kernel's, when it got there before the cap.
//
// `--per-pool` adds a row per pool and count with `--only`, that pool at the
// count and the others at one slot, and divides its growth over the one-slot
// server by the slots added: what one slot of that pool costs. Each figure is
// the median of `--runs` runs, beside their spread (min to max): the noise band.
//
// Linux only (`/proc`), run from the repository root.
import { spawn } from "node:child_process"
import { createSocket } from "node:dgram"
import { readFileSync } from "node:fs"
import { connect } from "node:net"
import { freemem } from "node:os"

const args = process.argv.slice(2)
let bin = "build/interop"
let counts = [16, 64, 256, 1024]
let timeout = 30
let runs = 3
let perPool = false
let cap = 0
for (let k = 0; k < args.length; k++) {
  const a = args[k]
  if (a === "--bin") {
    bin = args[++k]
  } else if (a === "--slots") {
    counts = args[++k].split(",").map(Number)
  } else if (a === "--timeout") {
    timeout = Number(args[++k])
  } else if (a === "--runs") {
    runs = Number(args[++k])
  } else if (a === "--cap") {
    cap = Number(args[++k])
  } else if (a === "--per-pool") {
    perPool = true
  } else {
    console.error(
      "usage: node bench/pool-rss.mjs [--bin <path>] [--slots a,b,...] [--timeout s] [--runs n] [--cap mb] [--per-pool]"
    )
    process.exit(2)
  }
}
if (counts.some((n) => !Number.isInteger(n) || n < 1 || n > 4096)) {
  console.error("--slots wants counts from 1 to 4096")
  process.exit(2)
}

/** The memory a server may grow to before it is killed, in kB: `--cap`, or three quarters of what is free now. */
const capNowKb = () => (cap > 0 ? cap * 1024 : Math.floor((freemem() / 1024) * 0.75))

/** The server being measured, killed on the way out however the script ends. */
let running = null
const stop = () => {
  if (running !== null) {
    running.removeAllListeners("exit")
    running.kill("SIGKILL")
    running = null
  }
}
process.once("SIGINT", () => {
  stop()
  process.exit(130)
})
// An exception ends the script through "exit" too, and `kill` is synchronous.
process.once("exit", stop)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** `VmRSS` and `VmHWM` of `pid` in kB, or null once it has gone. */
const memory = (pid) => {
  let text = ""
  try {
    text = readFileSync(`/proc/${pid}/status`, "utf8")
  } catch {
    return null
  }
  const field = (name) => Number(new RegExp(`^${name}:\\s+(\\d+)`, "m").exec(text)?.[1] ?? 0)
  return { rss: field("VmRSS"), hwm: field("VmHWM") }
}

/** Whether a TCP connection to `port` on loopback is accepted. */
const tcpAnswers = (port) =>
  new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port })
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("error", () => resolve(false))
  })

/**
 * A QUIC long-header packet of version 0x1a2a3a4a, one RFC 9000 reserves for
 * forcing Version Negotiation, padded to the 1,200 bytes a server answers.
 */
const probe = () => {
  const packet = Buffer.alloc(1200)
  packet[0] = 0xc0
  packet.writeUInt32BE(0x1a2a3a4a, 1)
  packet[5] = 8
  packet.fill(0x11, 6, 14)
  packet[14] = 8
  packet.fill(0x22, 15, 23)
  return packet
}

/** Whether the QUIC port answers `probe` within 200 ms. */
const quicAnswers = (port) =>
  new Promise((resolve) => {
    const socket = createSocket("udp4")
    const done = (answer) => {
      clearTimeout(timer)
      socket.close()
      resolve(answer)
    }
    const timer = setTimeout(() => done(false), 200)
    socket.once("message", (reply) => done(reply.length > 5 && reply.readUInt32BE(1) === 0))
    socket.once("error", () => done(false))
    socket.send(probe(), port, "127.0.0.1")
  })

/**
 * One server at `slots`, every pool or the one `only` names: how long it took
 * to answer on all four ports, and its memory then; or why it did not.
 */
const measure = (slots, only) =>
  new Promise((resolve) => {
    const argv = ["serve", "--host", "127.0.0.1", "--slots", String(slots)]
    if (only !== null) {
      argv.push("--only", only)
    }
    const capKb = capNowKb()
    const started = process.hrtime.bigint()
    const child = spawn(bin, argv, { stdio: ["ignore", "pipe", "ignore"] })
    running = child
    let out = ""
    let settled = false
    let peak = 0
    const finish = (result) => {
      if (settled) {
        return
      }
      settled = true
      clearInterval(watch)
      clearTimeout(timer)
      stop()
      resolve(result)
    }
    const watch = setInterval(() => {
      const m = memory(child.pid)
      if (m !== null) {
        peak = Math.max(peak, m.rss)
        if (m.rss > capKb) {
          finish({
            failed: `out of memory (past ${Math.round(capKb / 1024)} MB at ${Math.round(m.rss / 1024)} MB)`,
          })
        }
      }
    }, 20)
    const timer = setTimeout(
      () => finish({ failed: `timeout (${timeout} s, ${Math.round(peak / 1024)} MB resident)` }),
      timeout * 1000
    )
    child.once("exit", (code, signal) =>
      finish({
        failed:
          signal === "SIGKILL"
            ? `killed by SIGKILL before listening (possible OOM kill, ${Math.round(peak / 1024)} MB resident)`
            : `exited ${code ?? signal} before listening`,
      })
    )
    child.stdout.on("data", async (chunk) => {
      out += chunk
      const ports = /ports quic (\d+) h1 (\d+) h1s (\d+) h2 (\d+)/.exec(out)
      if (ports === null || settled) {
        return
      }
      child.stdout.removeAllListeners("data")
      child.stdout.resume()
      const [quic, ...tcp] = ports.slice(1).map(Number)
      while (!settled) {
        const answers = await Promise.all([quicAnswers(quic), ...tcp.map(tcpAnswers)])
        if (answers.every((a) => a)) {
          break
        }
        await sleep(10)
      }
      const ms = Number(process.hrtime.bigint() - started) / 1e6
      const m = memory(child.pid)
      finish(m === null ? { failed: "exited while answering" } : { ms, rss: m.rss, hwm: m.hwm })
    })
  })

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const mb = (kb) => (kb / 1024).toFixed(1)

/** `runs` runs of one configuration, stopping at the first failure; the medians and spreads, or the failure. */
const row = async (slots, only) => {
  const done = []
  for (let r = 0; r < runs; r++) {
    const result = await measure(slots, only)
    if (result.failed !== undefined) {
      return { failed: result.failed }
    }
    done.push(result)
  }
  const stat = (key) => {
    const xs = done.map((d) => d[key])
    return { median: median(xs), min: Math.min(...xs), max: Math.max(...xs) }
  }
  return { rss: stat("rss"), hwm: stat("hwm"), ms: stat("ms") }
}

const spread = (s, fmt) => `${fmt(s.median)} (${fmt(s.min)}–${fmt(s.max)})`

const capText = cap > 0 ? `${cap} MB` : `three quarters of free memory (${mb(capNowKb())} MB now)`
console.log(`${bin}, ${runs} runs each, killed past ${capText} or ${timeout} s`)
console.log("| pools | slots | VmRSS MB | VmHWM MB | listening ms | per slot |")
console.log("| --- | ---: | ---: | ---: | ---: | ---: |")
const configurations = [null, ...(perPool ? ["h1", "h1s", "h2", "h3"] : [])]
const base = perPool ? await row(1, null) : null
if (base !== null && base.failed === undefined) {
  console.log(
    `| all | 1 | ${spread(base.rss, mb)} | ${spread(base.hwm, mb)} | ${spread(base.ms, (x) => x.toFixed(0))} | |`
  )
}
for (const only of configurations) {
  for (const slots of counts) {
    const r = await row(slots, only)
    const pools = only ?? "all"
    if (r.failed !== undefined) {
      console.log(`| ${pools} | ${slots} | ${r.failed} | | | |`)
      continue
    }
    let perSlot = ""
    if (only !== null && base !== null && base.failed === undefined && slots > 1) {
      perSlot = `${((r.rss.median - base.rss.median) / (slots - 1)).toFixed(0)} kB`
    }
    console.log(
      `| ${pools} | ${slots} | ${spread(r.rss, mb)} | ${spread(r.hwm, mb)} | ${spread(r.ms, (x) => x.toFixed(0))} | ${perSlot} |`
    )
  }
}
