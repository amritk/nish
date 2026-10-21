#!/usr/bin/env node
// Server CPU per TLS 1.3 handshake. Drives tests/link/net_interop_server's
// `serve` mode, a byte-identical copy of the same binary and, with
// `--baseline`, the server built from another rev and a copy of it, in
// interleaved rounds. Each round starts every server fresh, pinned to CPU 0,
// and makes N new connections to its h2 port, each a full handshake: one
// `curl --http2 --tlsv1.3 -k` GET of a 17-byte file per process, pinned to
// CPUs 1-3, so no session is resumed. The server's utime + stime over the N
// is read from /proc/<pid>/stat. A copy differs from its build only by the
// machine, so the copy is the noise band. See bench/README.md ("TLS
// handshake") and docs/wp34-hosting-cs.md ("K5: P-256, the inversion").
//
//   npm run build && node bench/tls-handshake.mjs [options]
//     --runs N            timed rounds; every target runs once per round (default 16)
//     --handshakes N      handshakes per target per round (default 600)
//     --baseline REV      also time the server built from REV, in a worktree under
//                         build/, and a copy of it (repeatable)
//     --json FILE         also write every round's figures to FILE
//     --check             a few handshakes against this checkout's server; exit 0
//                         when each answered over TLS 1.3, X25519 and h2
//
// The clock tick is 10 ms on Linux, and a handshake about 2 ms of server CPU,
// so the default 600 a round puts one tick near 1% of a round's figure; the
// report prints the fewest ticks in any round so that can be read, not assumed.
import { spawn, spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, relative, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const build = join(root, "build")
// util-linux's taskset pins the server to CPU 0 and curl to CPUs 1-3.
const taskset = "taskset"
/** The file every handshake fetches: 17 bytes, as K5's profile fetched. */
const BODY = "hello, handshake\n"
/** Handshakes made against a fresh server before its clock is read. */
const WARM_UP = 5

const parseArgs = (argv) => {
  const opts = { runs: 16, handshakes: 600, baselines: [], json: "", check: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const value = () => {
      i++
      if (i >= argv.length) {
        throw new Error(`${a} wants a value`)
      }
      return argv[i]
    }
    if (a === "--runs") {
      opts.runs = Number(value())
    } else if (a === "--handshakes") {
      opts.handshakes = Number(value())
    } else if (a === "--baseline") {
      opts.baselines.push(value())
    } else if (a === "--json") {
      opts.json = resolve(value())
    } else if (a === "--check") {
      opts.check = true
    } else if (a === "-h" || a === "--help") {
      process.stdout.write(
        `${readFileSync(import.meta.filename, "utf8")
          .split("\n")
          .slice(1, 24)
          .join("\n")}\n`
      )
      process.exit(0)
    } else {
      throw new Error(`unknown argument ${a}`)
    }
  }
  if (!(opts.runs >= 1 && opts.handshakes >= 1)) {
    throw new Error("--runs and --handshakes take a positive number")
  }
  return opts
}

const run = (cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" })
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${r.status}\n${r.stdout}${r.stderr}`)
  }
  return r.stdout
}

/** The newest modification time of any file under `dir`, in ms. */
const newestSource = (dir) =>
  Math.max(
    ...readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => statSync(join(e.parentPath, e.name)).mtimeMs)
  )

/**
 * Builds the interop server of the checkout at `dir` into `out`, as
 * bench/h3-latency.mjs does. Each checkout builds its own compiler, because
 * the compiler reads `nish/` modules from the `std/` beside it: a baseline
 * built by this checkout's compiler would be this checkout's std.
 */
const buildServer = (dir, out) => {
  const nish = join(dir, "build", "nish")
  if (!existsSync(nish) || newestSource(join(dir, "src")) > statSync(nish).mtimeMs) {
    const seed = process.env.NISH_BOOTSTRAP || join(root, "build", "seed", "bin", "nish")
    if (!existsSync(seed)) {
      throw new Error("no seed: run bash scripts/fetch-seed.sh --force, or set NISH_BOOTSTRAP")
    }
    console.error(`building ${nish}`)
    mkdirSync(join(dir, "build"), { recursive: true })
    run(seed, ["src/compile.ts", "--link", nish], dir)
  }
  console.error(`building ${out}`)
  run(
    nish,
    ["tests/link/net_interop_server/main.ts", "-o", `${join(dir, "build", "interop")}/`, "--link", out],
    dir
  )
}

/** A git worktree of `rev` under build/, made once and reused while it still names `rev`. */
const baselineTree = (rev) => {
  const sha = run("git", ["rev-parse", `${rev}^{commit}`]).trim()
  const dir = join(build, `handshake-baseline-${sha.slice(0, 12)}`)
  if (!existsSync(dir)) {
    run("git", ["worktree", "add", "--detach", dir, sha])
  }
  return { sha, dir }
}

/** `bin` copied beside itself, checked byte for byte: the noise band's column. */
const copyOf = (bin) => {
  const copy = `${bin}-copy`
  copyFileSync(bin, copy)
  if (!readFileSync(bin).equals(readFileSync(copy))) {
    throw new Error(`${copy} differs from ${bin}`)
  }
  return copy
}

/** utime and stime of `pid`, in clock ticks (fields 14 and 15 of /proc/<pid>/stat). */
const cpuTicks = (pid) => {
  const stat = readFileSync(`/proc/${pid}/stat`, "utf8")
  // The command name is in parentheses and may hold spaces: count from after it.
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ")
  return { user: Number(fields[11]), sys: Number(fields[12]) }
}

const ticksPerSecond = Number(run("getconf", ["CLK_TCK"]).trim())

/**
 * Starts a server pinned to CPU 0 on ports the kernel picks, and resolves
 * with it and its h2 port once it has printed its ports. It mints its own key
 * and certificate first, as K5's profile let it, before the line is printed.
 */
const startServer = (bin, www) =>
  new Promise((done, failed) => {
    const args = ["serve", "--www", www, "--host", "127.0.0.1"]
    for (const p of ["--port", "--h1-port", "--h1s-port", "--h2-port"]) {
      args.push(p, "0")
    }
    const child = spawn(taskset, ["-c", "0", bin, ...args], { stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      failed(new Error(`${bin} printed no ports in 30 s:\n${output}`))
    }, 30_000)
    const read = (d) => {
      output += d
      const m = /ports quic \d+ h1 \d+ h1s \d+ h2 (\d+)/.exec(output)
      if (m !== null) {
        clearTimeout(timer)
        child.stdout.off("data", read)
        // Keep draining the pipes, so a server that writes more never blocks on them.
        child.stdout.resume()
        done({ child, port: Number(m[1]) })
      }
    }
    child.stdout.on("data", read)
    child.stderr.on("data", (d) => {
      output += d
    })
    child.on("exit", (code) => {
      clearTimeout(timer)
      failed(new Error(`${bin} exited ${code} before printing its ports:\n${output}`))
    })
  })

const stopServer = (child) =>
  new Promise((done) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      done()
      return
    }
    child.on("exit", () => done())
    child.kill("SIGTERM")
    setTimeout(() => child.kill("SIGKILL"), 3000)
  })

/**
 * One handshake: a new curl process, pinned to CPUs 1-3, GETs the file over
 * h2. Resolves with the handshake's latency as curl saw it, from the TCP
 * connection to the end of TLS, in µs, and with curl's verbose lines when
 * `verbose` is set.
 */
const handshake = (port, verbose) =>
  new Promise((done, failed) => {
    const args = ["-c", "1-3", "curl", "-s", "--http2", "--tlsv1.3", "-k"]
    if (verbose) {
      args.push("-v")
    }
    args.push(
      "-w",
      "\n%{http_code} %{http_version} %{time_connect} %{time_appconnect}",
      `https://127.0.0.1:${port}/f.txt`
    )
    const c = spawn(taskset, args, { stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    let err = ""
    c.stdout.on("data", (d) => {
      out += d
    })
    c.stderr.on("data", (d) => {
      err += d
    })
    c.on("error", failed)
    c.on("exit", (code) => {
      // The body, then the -w line after the last newline.
      const nl = out.lastIndexOf("\n")
      const m = /^(\d+) (\S+) ([\d.]+) ([\d.]+)$/.exec(out.slice(nl + 1))
      if (code !== 0 || m === null || out.slice(0, nl) !== BODY || m[1] !== "200" || m[2] !== "2") {
        failed(new Error(`curl against port ${port} exited ${code}:\n${out}\n${err}`))
        return
      }
      done({ us: (Number(m[4]) - Number(m[3])) * 1e6, verbose: err })
    })
  })

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const n = s.length
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

/**
 * One target's round: a fresh server, WARM_UP handshakes, then `count` timed
 * ones, the server's CPU read either side of them. The first handshake also
 * says what was negotiated, which every target must agree on.
 */
const measure = async (target, ctx) => {
  const { child, port } = await startServer(target.bin, ctx.www)
  try {
    const first = await handshake(port, true)
    const line = /SSL connection using (.+)$/m.exec(first.verbose)
    const alpn = /ALPN: server accepted (\S+)/.exec(first.verbose)
    const negotiated = `${line === null ? "?" : line[1]}, ALPN ${alpn === null ? "?" : alpn[1]}`
    for (let i = 1; i < WARM_UP; i++) {
      await handshake(port, false)
    }
    const before = cpuTicks(child.pid)
    const latencies = []
    for (let i = 0; i < ctx.handshakes; i++) {
      latencies.push((await handshake(port, false)).us)
    }
    const after = cpuTicks(child.pid)
    const user = after.user - before.user
    const sys = after.sys - before.sys
    const perHandshake = (ticks) => ((ticks / ticksPerSecond) * 1e6) / ctx.handshakes
    return {
      target: target.name,
      negotiated,
      ticks: user + sys,
      cpu: perHandshake(user + sys),
      user: perHandshake(user),
      sys: perHandshake(sys),
      latency: median(latencies),
    }
  } finally {
    await stopServer(child)
  }
}

/** `--check`: a few handshakes against this checkout's server, each over TLS 1.3, X25519 and h2. */
const check = async (bin, www) => {
  const { child, port } = await startServer(bin, www)
  try {
    for (let i = 0; i < 3; i++) {
      const r = await handshake(port, true)
      if (!/SSL connection using TLSv1\.3 \/ \S+ \/ X25519 /.test(r.verbose)) {
        throw new Error(`handshake ${i} did not negotiate TLS 1.3 with X25519:\n${r.verbose}`)
      }
      if (!/ALPN: server accepted h2/.test(r.verbose)) {
        throw new Error(`handshake ${i} did not negotiate h2:\n${r.verbose}`)
      }
    }
    const ticks = cpuTicks(child.pid)
    if (!(ticks.user + ticks.sys > 0)) {
      throw new Error(`/proc/${child.pid}/stat holds no CPU time for a server that minted a key`)
    }
  } finally {
    await stopServer(child)
  }
  console.log("tls-handshake: 3 handshakes over TLS 1.3, X25519 and h2")
}

const fmt = (us) => us.toFixed(0)
/** `to` against `from`, as a percentage of `from`: + is slower. */
const pct = (from, to) => `${to >= from ? "+" : ""}${((100 * (to - from)) / from).toFixed(1)}%`

/**
 * The table: per target, server CPU per handshake (and its user and system
 * parts) and curl's handshake latency, each min / median over the rounds.
 * Then each copy against its own build, the noise band, and each other build
 * against the first, at the minimum and the median.
 */
const report = (results, opts, targets) => {
  const by = (name) => results.filter((r) => r.target === name)
  const stat = (name, key) => {
    const xs = by(name).map((r) => r[key])
    return { min: Math.min(...xs), median: median(xs) }
  }
  const cell = (name, key) => {
    const s = stat(name, key)
    return `${fmt(s.min)} / ${fmt(s.median)}`
  }
  const lines = [
    `${opts.runs} rounds × ${opts.handshakes} handshakes a target, min / median over the rounds, µs a handshake`,
    "",
    "| target | server CPU | user | system | handshake latency (curl) |",
    "| --- | ---: | ---: | ---: | ---: |",
  ]
  for (const t of targets) {
    lines.push(
      `| ${t.name} | ${cell(t.name, "cpu")} | ${cell(t.name, "user")} | ${cell(t.name, "sys")} | ${cell(t.name, "latency")} |`
    )
  }
  const against = (a, b) => {
    const x = stat(a, "cpu")
    const y = stat(b, "cpu")
    return `${pct(y.min, x.min)} / ${pct(y.median, x.median)}`
  }
  lines.push("", "Server CPU, min / median (+ is slower):")
  for (const t of targets.filter((c) => c.copyOf !== undefined)) {
    lines.push(`  noise: ${t.name} against ${t.copyOf}: ${against(t.name, t.copyOf)}`)
  }
  const builds = targets.filter((b) => b.copyOf === undefined)
  for (const t of builds.slice(1)) {
    lines.push(`  ${t.name} against ${builds[0].name}: ${against(t.name, builds[0].name)}`)
  }
  const ticks = Math.min(...results.map((r) => r.ticks))
  const negotiated = [...new Set(results.map((r) => r.negotiated))].join("; ")
  const cpu = /^model name\s*:\s*(.+)$/m.exec(readFileSync("/proc/cpuinfo", "utf8"))
  lines.push(
    "",
    `Fewest ticks in a round: ${ticks} (one tick ${(100 / ticks).toFixed(2)}% of it), at ${ticksPerSecond} Hz.`,
    `Negotiated: ${negotiated}.`,
    `On ${cpu === null ? "an unknown CPU" : cpu[1].trim()}.`
  )
  return lines.join("\n")
}

const main = async () => {
  const opts = parseArgs(process.argv.slice(2))
  if (spawnSync(taskset, ["-c", "0", "true"]).status !== 0) {
    throw new Error("taskset -c 0 failed: the harness pins the server to CPU 0 and curl to 1-3")
  }
  const server = join(build, "interop-server")
  buildServer(root, server)

  const tmp = mkdtempSync(join(tmpdir(), "nish-handshake-"))
  const www = join(tmp, "www")
  mkdirSync(www)
  writeFileSync(join(www, "f.txt"), BODY)
  const results = []
  try {
    if (opts.check) {
      await check(server, www)
      return
    }
    // A working tree with uncommitted changes is not the commit it names.
    const dirty = run("git", ["status", "--porcelain", "--untracked-files=no"]).trim() !== ""
    const head = `${run("git", ["rev-parse", "--short=7", "HEAD"]).trim()}${dirty ? "+dirty" : ""}`
    const targets = [
      { name: head, bin: server },
      { name: `${head} copy`, bin: copyOf(server), copyOf: head },
    ]
    for (const rev of opts.baselines) {
      const { sha, dir } = baselineTree(rev)
      const name = sha.slice(0, 7)
      // Rounds are pooled by name, so two targets sharing one would be read as one.
      if (targets.some((t) => t.name === name)) {
        throw new Error(`--baseline ${rev} names ${name}, a target already measured`)
      }
      const bin = join(build, `interop-server-${sha.slice(0, 12)}`)
      buildServer(dir, bin)
      targets.push({ name, bin }, { name: `${name} copy`, bin: copyOf(bin), copyOf: name })
    }
    for (const t of targets) {
      console.error(`${t.name}: ${relative(root, t.bin)}`)
    }
    for (let round = 1; round <= opts.runs; round++) {
      // Rotated each round, so no target always runs first or last.
      for (let k = 0; k < targets.length; k++) {
        const t = targets[(k + round - 1) % targets.length]
        const r = await measure(t, { www, handshakes: opts.handshakes })
        r.round = round
        results.push(r)
        console.error(
          `round ${round} ${t.name}: ${fmt(r.cpu)} µs CPU (${r.ticks} ticks), ` +
            `handshake ${fmt(r.latency)} µs; ${r.negotiated}`
        )
      }
    }
    if (new Set(results.map((r) => r.negotiated)).size !== 1) {
      throw new Error("the targets negotiated different handshakes: their CPU is not the same work")
    }
    console.log(report(results, opts, targets))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
    if (opts.json !== "") {
      writeFileSync(opts.json, `${JSON.stringify(results, null, 2)}\n`)
    }
  }
}

main().catch((e) => {
  console.error(`tls-handshake: ${e.message}`)
  process.exit(1)
})
