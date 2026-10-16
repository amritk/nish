#!/usr/bin/env node
// An HTTP/1.1 server under load: bench/http-server.ts answering a keep-alive
// client on loopback, timed in requests a second. It is the measure a change
// to `nish/net/http1-server`'s response path is judged by, and it reports the
// noise band such a change has to stand out of.
//
//   npm run build && node bench/http.mjs [options] [--compiler <nish>]
//     --runs N           timed rounds after one warm-up (default 15)
//     --self             a byte-identical copy of the tree's build as a column: the noise band
//     --base <ref>       the server built from a git ref as a column (implies --self)
//     --requests N       requests a run sends (default 200000)
//     --connections N    keep-alive connections a run holds open (default 32)
//     --workers N        client threads the connections are spread over (default 2)
//
// The columns. `tree` is bench/http-server.ts built by the compiler with
// `--profile speed`, into build/bench/http/. `copy` is a byte-for-byte copy of
// that binary under another name: what separates a build from itself on this
// machine, in these rounds, is the band a difference has to clear. `base` is
// the same source built against another ref's `nish/` library and runtime, in a
// git worktree under build/bench/http/ that is removed on exit. When the ref's
// `src/` matches the tree's, the tree's compiler is copied into the worktree's
// build/, so it reads the ref's std/, runtime/ and scripts/build.sh, the way an
// installed compiler reads its own; when `src/` differs, the worktree builds
// its own compiler with scripts/bootstrap.sh first. The program is always this
// tree's bench/http-server.ts, so a ref that predates it can still be a base.
//
// A run. The server starts on a free port and prints it; the client opens its
// connections, the clock starts, and each connection sends a request, reads
// the whole response, and sends the next, until the run's requests are
// answered; the clock stops at the last response. Every response must be a 200
// whose body is `Hello, World!`, or the run stops. The client then closes its
// connections, and the server, having answered every request and seen every
// connection close, prints how many it served and a checksum: the wrapping sum
// of an FNV-1a hash of each response's status and body length. The client sums
// the same over what it received, and the two must agree, as must every run of
// every column: a column that served nothing, or served something else, stops
// the bench. The columns run in rotating rounds, each going first equally
// often, so a slow stretch of a shared machine falls on all of them.
//
// What it reports. Each column's minimum and median requests a second, the
// median being the figure to compare, and the band: the copy's rate over the
// tree's in each round, as its minimum and maximum, in percent. A base whose
// own ratio to the tree falls inside the band is not measurably different.
import { execFileSync, spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { isMainThread, parentPort, Worker } from "node:worker_threads"

/** The request every connection sends, and the body every response must carry. */
const REQUEST = Buffer.from("GET /plaintext HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n", "latin1")
const BODY = Buffer.from("Hello, World!", "latin1")
const HEAD_END = Buffer.from("\r\n\r\n", "latin1")

/** FNV-1a over a response's status and then its body length, as bench/http-server.ts hashes it. */
const hash = (status, length) => {
  let h = 2166136261
  h = Math.imul(h ^ status, 16777619) >>> 0
  h = Math.imul(h ^ length, 16777619) >>> 0
  return h
}

// ---- The client: one worker thread's share of the connections -------------------------------

/**
 * One keep-alive connection's run: send `count` requests one after another,
 * check each response, and resolve with the sum of their hashes. A response
 * may arrive in pieces, and nothing is sent until the last one is whole.
 */
const drive = (socket, count) =>
  new Promise((resolve, reject) => {
    let left = count
    let sum = 0
    let pending = Buffer.alloc(0)
    const onData = (chunk) => {
      pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk])
      while (true) {
        const end = pending.indexOf(HEAD_END)
        if (end < 0) {
          return
        }
        const head = pending.toString("latin1", 0, end)
        const length = Number(/\r\ncontent-length:[ \t]*(\d+)/i.exec(head)?.[1] ?? Number.NaN)
        if (!(length >= 0)) {
          return fail(`a response without a Content-Length: ${JSON.stringify(head)}`)
        }
        if (pending.length < end + 4 + length) {
          return
        }
        const status = Number(head.slice(9, 12))
        const body = pending.subarray(end + 4, end + 4 + length)
        if (!head.startsWith("HTTP/1.1 ") || status !== 200 || !body.equals(BODY)) {
          return fail(
            `an unexpected response: ${JSON.stringify(head)} ${JSON.stringify(body.toString("latin1"))}`
          )
        }
        sum = (sum + hash(status, length)) >>> 0
        pending = pending.subarray(end + 4 + length)
        left--
        if (left === 0) {
          socket.off("data", onData)
          if (pending.length > 0) {
            return fail(`${pending.length} bytes after the last response`)
          }
          return resolve(sum)
        }
        if (pending.length === 0) {
          socket.write(REQUEST)
        }
      }
    }
    const fail = (msg) => {
      socket.off("data", onData)
      reject(new Error(msg))
    }
    socket.on("data", onData)
    socket.write(REQUEST)
  })

/** Opens `n` connections to `port`, each with Nagle off, as a load client's are. */
const connectAll = (port, n) =>
  Promise.all(
    Array.from(
      { length: n },
      () =>
        new Promise((resolve, reject) => {
          const socket = net.connect({ host: "127.0.0.1", port, noDelay: true })
          socket.once("connect", () => resolve(socket))
          socket.once("error", reject)
        })
    )
  )

/**
 * A worker's side of the protocol. `connect` opens its connections and
 * answers `ready`; `go` drives them and answers the requests and checksum;
 * `close` ends them and answers `closed` once each has closed. Any error is
 * answered as `error`, and the main thread stops the bench on it.
 */
const worker = () => {
  let sockets = []
  parentPort.on("message", async (msg) => {
    try {
      if (msg.type === "connect") {
        sockets = await connectAll(msg.port, msg.connections)
        for (const s of sockets) {
          s.on("error", (e) => parentPort.postMessage({ type: "error", message: e.message }))
        }
        parentPort.postMessage({ type: "ready" })
      } else if (msg.type === "go") {
        const sums = await Promise.all(sockets.map((s, i) => drive(s, msg.counts[i])))
        const checksum = sums.reduce((a, b) => (a + b) >>> 0, 0)
        parentPort.postMessage({ type: "done", checksum })
      } else if (msg.type === "close") {
        await Promise.all(
          sockets.map(
            (s) => new Promise((resolve) => (s.destroyed ? resolve() : s.once("close", resolve).end()))
          )
        )
        sockets = []
        parentPort.postMessage({ type: "closed" })
      }
    } catch (e) {
      parentPort.postMessage({ type: "error", message: e.message })
    }
  })
}

// ---- The driver ------------------------------------------------------------------------------

const main = async () => {
  const { compilerFrom } = await import("./compiler.mjs")
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const outDir = path.join(root, "build", "bench", "http")
  const nishc = compilerFrom(process.argv)

  /** What to undo on the way out, however the bench ends: the server, the workers, the worktree. */
  const cleanups = []
  const cleanup = () => {
    while (cleanups.length > 0) {
      try {
        cleanups.pop()()
      } catch {
        // One undo failing leaves the others to run.
      }
    }
  }
  process.on("exit", cleanup)
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => process.exit(130))
  }
  const fail = (msg) => {
    console.error(`bench/http.mjs: ${msg}`)
    process.exit(2)
  }

  let runs = 15
  let self = false
  let baseRef = null
  let requests = 200000
  let connections = 32
  let workers = 2
  const argv = nishc.rest
  const count = (flag, v) => {
    const n = Number(v)
    if (!(Number.isInteger(n) && n >= 1)) {
      fail(`${flag} needs a positive count`)
    }
    return n
  }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--runs") {
      runs = count("--runs", argv[++i])
    } else if (argv[i] === "--self") {
      self = true
    } else if (argv[i] === "--base") {
      baseRef = argv[++i]
      if (baseRef === undefined) {
        fail("--base needs a git ref")
      }
      self = true
    } else if (argv[i] === "--requests") {
      requests = count("--requests", argv[++i])
    } else if (argv[i] === "--connections") {
      connections = count("--connections", argv[++i])
    } else if (argv[i] === "--workers") {
      workers = count("--workers", argv[++i])
    } else {
      fail(`unknown option ${argv[i]}`)
    }
  }
  if (workers > connections) {
    fail("--workers may not exceed --connections")
  }
  if (connections > requests) {
    fail("--connections may not exceed --requests")
  }

  fs.mkdirSync(outDir, { recursive: true })
  const rel = (p) => path.relative(root, p)

  const run = (cmd, args, what, cwd = root, env = process.env) => {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] })
    if (r.status !== 0) {
      fail(`${what}: ${cmd} ${args.join(" ")} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
    }
    return r.stdout
  }
  const git = (...args) => run("git", args, "git").trim()

  // ---- The builds ----

  /** Builds `source` with the compiler `cmd prefix`, run from `cwd`, into `exe`. */
  const build = (cmd, prefix, cwd, source, exe, what) =>
    run(cmd, [...prefix, source, "--link", exe, "--profile", "speed"], what, cwd)

  const columns = []
  const tree = path.join(outDir, "http-server")
  build(nishc.cmd, nishc.prefix, root, "bench/http-server.ts", rel(tree), "tree")
  columns.push({ label: "tree", exe: tree })
  if (self) {
    // A copy rather than the same path twice, as bench/simd-s0.mjs --self makes
    // one: each is its own file, mapped on its own.
    const copy = path.join(outDir, "http-server-copy")
    fs.copyFileSync(tree, copy)
    columns.push({ label: "copy", exe: copy })
  }

  let baseNote = null
  if (baseRef !== null) {
    const sha = git("rev-parse", "--verify", `${baseRef}^{commit}`)
    const short = sha.slice(0, 10)
    const work = path.join(outDir, `base-${short}`)
    // A worktree left by a run that was killed is removed first, so the base is
    // always a fresh checkout of the ref and never a stale one.
    if (fs.existsSync(work)) {
      spawnSync("git", ["worktree", "remove", "--force", work], { cwd: root })
      fs.rmSync(work, { recursive: true, force: true })
    }
    spawnSync("git", ["worktree", "prune"], { cwd: root })
    git("worktree", "add", "--detach", "--quiet", work, sha)
    cleanups.push(() => {
      spawnSync("git", ["worktree", "remove", "--force", work], { cwd: root })
      fs.rmSync(work, { recursive: true, force: true })
      spawnSync("git", ["worktree", "prune"], { cwd: root })
    })
    // Against the working tree, so an uncommitted change to src/ counts too.
    const srcDiffers = spawnSync("git", ["diff", "--quiet", sha, "--", "src"], { cwd: root }).status !== 0
    const baseNish = path.join(work, "build", "nish")
    if (srcDiffers) {
      console.log(
        `base: ${baseRef}'s src/ differs from the tree's; building its compiler (scripts/bootstrap.sh)`
      )
      run("bash", ["scripts/bootstrap.sh"], `base ${baseRef} bootstrap`, work)
      baseNote = `${baseRef} (${short}), built by its own compiler`
    } else {
      // The compiler finds its package from the directory it is run from:
      // `<dir of argv[0]>/..` (src/compile.ts, packageRootCandidates). A copy,
      // not a link, so the worktree is the only root it can find.
      if (nishc.prefix.length > 0) {
        fail("--base copies the compiler into the worktree, so it needs a native one, not a Node entry point")
      }
      fs.mkdirSync(path.dirname(baseNish), { recursive: true })
      fs.copyFileSync(fs.realpathSync(nishc.cmd), baseNish)
      fs.chmodSync(baseNish, 0o755)
      baseNote = `${baseRef} (${short}), its std/ and runtime/ under the tree's compiler (src/ is the same)`
    }
    // The proof that the base compiler reads the ref's library and not the
    // tree's: a module that exists only in the worktree's std/ must resolve.
    // Built before the program, and removed again, so the checkout it builds
    // from is the ref's as git has it.
    const canary = `bench-http-canary-${process.pid}`
    const canaryModule = path.join(work, "std", `${canary}.ts`)
    const probe = path.join(work, "build", "bench", "http", "canary.ts")
    fs.mkdirSync(path.dirname(probe), { recursive: true })
    fs.writeFileSync(canaryModule, "export const canary: i32 = 0\n")
    fs.writeFileSync(
      probe,
      `import { canary } from "nish/${canary}"\nexport const main = (): i32 => canary\n`
    )
    const probed = spawnSync(
      baseNish,
      [path.relative(work, probe), "-o", path.join(path.dirname(probe), "canary.ll")],
      {
        cwd: work,
        encoding: "utf8",
      }
    )
    fs.rmSync(canaryModule)
    if (probed.status !== 0) {
      fail(
        `base ${baseRef}: its compiler does not read the worktree's std/\n${probed.stdout}${probed.stderr}`
      )
    }
    // The tree's program, so a ref that predates bench/http-server.ts can be a base.
    const source = path.join(work, "build", "bench", "http", "http-server.ts")
    fs.copyFileSync(path.join(root, "bench", "http-server.ts"), source)
    const exe = path.join(outDir, `http-server-base-${short}`)
    build(baseNish, [], work, path.relative(work, source), exe, `base ${baseRef}`)
    columns.push({ label: "base", exe })
  }

  // ---- A run ----

  const pool = Array.from({ length: workers }, () => {
    const w = new Worker(fileURLToPath(import.meta.url))
    w.unref()
    return w
  })
  cleanups.push(() => {
    for (const w of pool) {
      w.terminate()
    }
  })
  /** Sends every worker its message and waits for each to answer `type`. */
  const each = (messages, type) =>
    Promise.all(
      pool.map(
        (w, i) =>
          new Promise((resolve, reject) => {
            const on = (m) => {
              if (m.type === type || m.type === "error") {
                w.off("message", on)
                if (m.type === "error") {
                  reject(new Error(m.message))
                } else {
                  resolve(m)
                }
              }
            }
            w.on("message", on)
            w.postMessage(messages[i])
          })
      )
    )

  // The connections, dealt round the workers, and the requests, dealt round the
  // connections: each connection sends its share one after another.
  const share = (total, parts) =>
    Array.from({ length: parts }, (_, i) => Math.floor((total + parts - 1 - i) / parts))
  const perWorker = share(connections, workers)
  const perConnection = share(requests, connections)
  const counts = []
  for (let w = 0, at = 0; w < workers; at += perWorker[w], w++) {
    counts.push(perConnection.slice(at, at + perWorker[w]))
  }

  /** One run of a column: { rps, answer }, the answer being what the server printed. */
  const once = async (column) => {
    const child = spawn(column.exe, [String(requests)], { stdio: ["ignore", "pipe", "pipe"] })
    const kill = () => child.kill("SIGKILL")
    cleanups.push(kill)
    let out = ""
    let err = ""
    child.stderr.on("data", (d) => {
      err += d
    })
    const exited = new Promise((resolve) =>
      child.on("exit", (status, by) => resolve({ code: status, signal: by }))
    )
    const port = await new Promise((resolve, reject) => {
      child.stdout.on("data", (d) => {
        out += d
        const m = /^port (\d+)\n/.exec(out)
        if (m) {
          resolve(Number(m[1]))
        }
      })
      exited.then((e) =>
        reject(
          new Error(
            `${column.label}: the server exited (${e.code ?? e.signal}) before its port\n${out}${err}`
          )
        )
      )
    })
    let checksum = 0
    let rps = 0
    try {
      await each(
        counts.map((c) => ({ type: "connect", port, connections: c.length })),
        "ready"
      )
      const t0 = process.hrtime.bigint()
      const done = await each(
        counts.map((c) => ({ type: "go", counts: c })),
        "done"
      )
      const s = Number(process.hrtime.bigint() - t0) / 1e9
      rps = requests / s
      checksum = done.reduce((a, m) => (a + m.checksum) >>> 0, 0)
      await each(
        pool.map(() => ({ type: "close" })),
        "closed"
      )
    } catch (e) {
      fail(`${column.label}: ${e.message}\n${out}${err}`)
    }
    const { code, signal } = await exited
    cleanups.splice(cleanups.indexOf(kill), 1)
    const served = /^served (\d+) checksum (\d+)$/m.exec(out)
    if (code !== 0 || !served) {
      fail(`${column.label}: the server exited with ${code ?? signal}\n${out}${err}`)
    }
    const answer = `served ${served[1]} checksum ${served[2]}`
    const sent = `served ${requests} checksum ${checksum}`
    if (answer !== sent) {
      fail(`${column.label}: the server printed "${answer}", its client received "${sent}"`)
    }
    return { rps, answer }
  }

  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b)
    const mid = s.length >> 1
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
  }

  // The rotation bench/simd-s0.mjs's timeAlternating makes, one round at a
  // time: one warm-up round of every column, then `runs` rounds rounded up to a
  // multiple of the columns, each starting one column further along. Every run
  // of every column must print the same answer.
  const n = columns.length
  const rounds = Math.ceil(runs / n) * n
  const rates = columns.map(() => [])
  let answer = null
  for (let i = 0; i <= rounds; i++) {
    const order = columns.map((_, j) => (i + 1 + j) % n)
    const round = []
    for (const k of order) {
      const r = await once(columns[k])
      if (answer !== null && r.answer !== answer) {
        fail(`${columns[k].label}: round ${i} printed "${r.answer}", not "${answer}"`)
      }
      answer = r.answer
      round[k] = r.rps
    }
    if (i > 0) {
      for (const [k, rps] of round.entries()) {
        rates[k].push(rps)
      }
    }
  }

  // ---- The report ----

  const fmt = (x) => Math.round(x).toLocaleString("en-US").padStart(9)
  for (const [k, column] of columns.entries()) {
    console.log(
      `${column.label.padEnd(6)} min ${fmt(Math.min(...rates[k]))} req/s  median ${fmt(median(rates[k]))} req/s  ${answer}`
    )
  }
  /** Column `k`'s rate over the tree's in each round, as min, median and max percent differences. */
  const ratio = (k) => {
    const r = rates[k].map((x, i) => (100 * (x - rates[0][i])) / rates[0][i])
    return `${Math.min(...r).toFixed(1)}% .. ${Math.max(...r).toFixed(1)}% (median ${median(r).toFixed(1)}%)`
  }
  const commit = (() => {
    try {
      return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
    } catch {
      return "unknown"
    }
  })()
  const cpu = (() => {
    try {
      const m = fs.readFileSync("/proc/cpuinfo", "utf8").match(/^model name\s*:\s*(.+)$/m)
      return m ? m[1].trim() : "unknown"
    } catch {
      return "unknown"
    }
  })()
  console.log(
    `\n${rounds} rotating rounds of ${n} after one warm-up; ${requests} requests a run over ${connections} connections in ${workers} client threads; at ${commit}, on ${cpu}`
  )
  if (self) {
    console.log(`band: copy against tree, per round ${ratio(1)}`)
  }
  if (baseNote !== null) {
    console.log(`base: ${baseNote}`)
    console.log(`base against tree, per round ${ratio(columns.length - 1)}`)
  }
  cleanup()
  process.exit(0)
}

if (isMainThread) {
  await main()
} else {
  worker()
}
