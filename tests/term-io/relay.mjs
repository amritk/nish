// A fake terminal for `nish/term-io`: runs a program under `script(1)`'s
// pseudo-terminal with stdin a pipe this side writes, so the program reads
// what the relay says as a terminal's answers. It answers the probe as kitty
// 0.49 does (the reply `tests/link/std_term_probe/fixtures.ts` pins), each
// frame's `CSI 5 n` with `CSI 0 n` when a modelled link would have delivered
// it, sends scripted keys after a number of frames, and samples the program's
// resident memory. Linux only: it finds the program through /proc.
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

/** What kitty 0.49 answers `probeQueries` with; DA1 (`CSI c`) is asked last. */
export const KITTY_REPLY =
  "\x1bP>|kitty(0.49.2)\x1b\\\x1b[?2026;2$y\x1b[?1016;2$y\x1b[?0u\x1b_Gi=31;OK\x1b\\" +
  "\x1b[6;20;10t\x1b[4;480;800t\x1bP1$r0;48:2:1:2:3m\x1b\\\x1b[?62;52;c"

/** The variables kitty sets, and none that names a multiplexer, SSH or an override. */
const KITTY_ENV = Object.fromEntries(
  ["TMUX", "STY", "SSH_CONNECTION", "SSH_CLIENT", "SSH_TTY", "NO_COLOR", "NISH_TERM_GRAPHICS", "NISH_TERM_FPS", "TERM_PROGRAM"]
    .map((name) => [name, ""])
    .concat([["TERM", "xterm-kitty"], ["COLORTERM", "truecolor"]])
)

/** How many bytes of output `out` keeps, at least. */
const KEEP = 1 << 20

const DA1 = "\x1b[c"
const DSR5 = "\x1b[5n"

/** The resident set of `pid` in kilobytes, or -1 once it is gone. */
const rssKb = (pid) => {
  try {
    const m = /VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${pid}/status`, "utf8"))
    return m === null ? -1 : Number(m[1])
  } catch {
    return -1
  }
}

/**
 * Run `exe mode` in a 200×60 pseudo-terminal and play the terminal. Options:
 *   dir          scratch directory for the shell script and its files
 *   env          extra environment for the program
 *   reply        what to answer DA1 with (KITTY_REPLY), or null for silence
 *   link         `{ rttMs, bytesPerSec }`: an answer leaves once the frame's
 *                bytes have crossed the link after the one before it, plus
 *                the round trip; null answers at once
 *   keys         `[{ afterFrames, bytes }]`, sent once that many frames are seen
 *   rssAt        frame counts to sample the program's memory at, before keys
 *   stdoutPipe   pipe the program's stdout through cat inside the terminal
 *   stdinNull    give the program /dev/null for stdin
 *   timeoutMs    when to kill the run (20 s)
 * Answers `{ out, err, status, frames, maxUnacked, keySentNs, rss, sameStty, timedOut }`:
 * `out` the last megabyte or more of the program's stdout with `\r` removed, `err` its stderr, `status`
 * its exit status, `keySentNs` the monotonic time each key was written,
 * `rss` `[{ frames, kb }]`, `sameStty` whether `stty -g` read the same after.
 */
export const relay = (exe, mode, options) => {
  const o = { env: {}, reply: KITTY_REPLY, link: null, keys: [], rssAt: [], timeoutMs: 20000, ...options }
  fs.rmSync(o.dir, { recursive: true, force: true })
  fs.mkdirSync(o.dir, { recursive: true })
  const sh = path.join(o.dir, "run.sh")
  const run = o.stdinNull ? '"$E" "$M" </dev/null' : '"$E" "$M" </dev/tty'
  fs.writeFileSync(
    sh,
    [
      'E="$NISH_RELAY_EXE"; M="$NISH_RELAY_MODE"; D="$NISH_RELAY_DIR"',
      "stty cols 200 rows 60",
      'stty -g > "$D/before"',
      o.stdoutPipe
        ? `{ ${run} 2> "$D/err"; echo $? > "$D/status"; } | cat`
        : `${run} 2> "$D/err" & echo $! > "$D/pid"; wait $!; echo $? > "$D/status"`,
      'stty -g > "$D/after"',
      "",
    ].join("\n")
  )
  const child = spawn("script", ["-qec", 'sh "$NISH_RELAY_SH"', "/dev/null"], {
    env: { ...process.env, ...KITTY_ENV, ...o.env, NISH_RELAY_SH: sh, NISH_RELAY_EXE: exe, NISH_RELAY_MODE: mode, NISH_RELAY_DIR: o.dir },
    stdio: ["pipe", "pipe", "pipe"],
  })
  const chunks = []
  let kept = 0
  let tail = ""
  let replied = false
  let frames = 0
  let acks = 0
  let maxUnacked = 0
  let frameBytes = 0
  let linkFree = 0
  let pid = 0
  const keySentNs = []
  const rss = []
  const keys = [...o.keys]
  const rssAt = [...o.rssAt]
  const start = performance.now()
  const send = (s) => {
    if (!child.stdin.destroyed) child.stdin.write(s)
  }
  const programPid = () => {
    if (pid === 0) {
      try {
        pid = Number(fs.readFileSync(path.join(o.dir, "pid"), "utf8").trim()) || 0
      } catch {}
    }
    return pid
  }
  const onFrame = (bytes) => {
    frames++
    maxUnacked = Math.max(maxUnacked, frames - acks)
    while (rssAt.length > 0 && frames >= rssAt[0]) {
      rss.push({ frames: rssAt.shift(), kb: rssKb(programPid()) })
    }
    while (keys.length > 0 && frames >= keys[0].afterFrames) {
      keySentNs.push(process.hrtime.bigint())
      send(keys.shift().bytes)
    }
    const ack = () => {
      acks++
      send("\x1b[0n")
    }
    if (o.link === null) {
      ack()
      return
    }
    const now = performance.now() - start
    linkFree = Math.max(linkFree, now) + (bytes * 1000) / o.link.bytesPerSec
    setTimeout(ack, linkFree + o.link.rttMs - now)
  }
  child.stdout.on("data", (chunk) => {
    // Only the end of the output is kept: a sixel run writes hundreds of megabytes.
    chunks.push(chunk)
    kept += chunk.length
    while (kept - chunks[0].length >= KEEP) kept -= chunks.shift().length
    // Look for the markers across chunk boundaries: keep the last bytes.
    const text = tail + chunk.toString("latin1")
    let from = 0
    if (!replied && o.reply !== null) {
      const at = text.indexOf(DA1)
      if (at >= 0) {
        replied = true
        send(o.reply)
      }
    }
    for (let at = text.indexOf(DSR5, from); at >= 0; at = text.indexOf(DSR5, from)) {
      frameBytes += at - from
      onFrame(frameBytes)
      frameBytes = 0
      from = at + DSR5.length
    }
    frameBytes += Math.max(0, text.length - 3 - from)
    tail = text.slice(Math.max(from, text.length - 3))
  })
  const stderr = []
  child.stderr.on("data", (c) => stderr.push(c))
  return new Promise((resolve) => {
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
      const p = programPid()
      if (p > 0) {
        try {
          process.kill(p, "SIGKILL")
        } catch {}
      }
    }, o.timeoutMs)
    child.on("close", () => {
      clearTimeout(timer)
      child.stdin.destroy()
      const read = (f) => {
        try {
          return fs.readFileSync(path.join(o.dir, f), "utf8")
        } catch {
          return ""
        }
      }
      resolve({
        out: Buffer.concat(chunks).toString("latin1").replaceAll("\r", ""),
        err: read("err"),
        status: read("status").trim() === "" ? -1 : Number(read("status").trim()),
        frames,
        maxUnacked,
        keySentNs,
        rss,
        sameStty: read("before") !== "" && read("before") === read("after"),
        timedOut,
        scriptErr: Buffer.concat(stderr).toString("utf8"),
      })
    })
  })
}
