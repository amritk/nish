// `nish run --watch`: the supervisor that rebuilds a program when one of its
// sources changes and swaps the running process for the new build.
//
// The supervisor is a Nish program of its own, kept here as source and
// compiled by the compiler that runs it, into the run cache, the first time a
// watch starts. It has to be: the compiler links to wasm as well, where
// `spawn`, `kill`, `waitPid`, `signalFd` and `statMtimeSync` are refused, and
// the watch loop needs every one of them. A program the compiler builds for
// the machine it runs on has them all.
//
// Each rebuild is the compiler again (`nish run --watch-build=<state> ...`),
// so a build is exactly what `nish run` builds, it shares `nish run`'s cache,
// and its diagnostics are the ones the same line without `--watch` prints.
// It leaves the binary's path, whether the program uses the network, and the
// files it was built from in the state file (`watchState`) for the supervisor
// to read.

import { programUsesNet } from "./capability-report"
import { Compilation } from "./compilation"
import { isStdModule } from "./std-modules"
import { StringBuilder } from "./strings"

/**
 * What a `--watch-build` leaves for the supervisor, one item per line: the
 * binary, `1` when the program can use the network (and so is a server that
 * the swap starts beside the old one), and every module it was built from.
 * The standard library is left out of an installed compiler's list, since an
 * install does not change under a running watch, and kept in a checkout's,
 * where editing `std/` is the work being watched.
 */
export const watchState = (compilation: Compilation, binary: string, checkout: boolean): string => {
  const out = new StringBuilder()
  out.add(`${binary}\n`)
  out.add(programUsesNet(compilation) ? "1\n" : "0\n")
  for (const unit of compilation.modules) {
    if (checkout || !isStdModule(compilation.libraryRoot(), unit.name, unit.path)) {
      out.add(`${unit.path}\n`)
    }
  }
  return out.toText()
}

/**
 * The supervisor's arguments, after its own name: the pid of the `nish run`
 * that started it, whose exit stops the watch; the state file; the entry,
 * watched until the first build names the rest; the number of words in the build
 * command, the build command; and the program's own arguments.
 *
 * It watches by polling modification times, every `POLL_MS`: the language has
 * no file-change events, and a program's modules are few enough that a stat
 * of each is cheap. A change waits `DEBOUNCE_MS` for the editor's next write
 * before it builds, and a change during a build stops that build and starts
 * again, so the build that finishes is the one of the files as they are.
 *
 * A server (one that uses the network) is swapped by starting the new build
 * first and stopping the old one only once the new one has run `SETTLE_MS`:
 * a server that listens with `SO_REUSEPORT` shares its port with the new one
 * meanwhile, and the old one is sent SIGTERM to finish what it holds. Any
 * other program is stopped before the new build starts, since two copies of
 * it would write the same terminal and files. A stop is SIGTERM and `GRACE_MS` to exit, then
 * SIGKILL. Each program is started with `NISH_WATCH=1` set, through `env`,
 * because a Nish program cannot set its children's environment.
 */
export const WATCH_SUPERVISOR_SOURCE: string = `// The supervisor \`nish run --watch\` starts. Its arguments are the driver's
// pid, the state file a build writes, the entry file, the length of the build
// command, the build command, and the program's arguments.
import { splitLines } from "nish/text"

const POLL_MS: i32 = 100
const DEBOUNCE_MS: i64 = 100
const SETTLE_MS: i32 = 300
const GRACE_MS: i64 = 5000
const MS: i64 = 1000000

class Watch {
  ready: i32[]
  state: string = ""
  build: string[]
  args: string[]
  files: string[]
  stamps: f64[]
  builtFrom: i64 = 0
  due: i64 = 0
  loop: i32 = -1
  signals: i32 = -1
  stop: i32 = 0
  driver: i32 = 0
  program: i32 = 0
  builder: i32 = 0
  builds: i32 = 0
  server: boolean = false
  pending: boolean = true
  constructor() {
    this.ready = [0, 0]
    this.build = []
    this.args = []
    this.files = []
    this.stamps = []
  }
}

const stampOf = (path: string): f64 => {
  const m: f64 = statMtimeSync(path)
  return m === m ? m : -1
}

const millisSince = (from: i64): i64 => (monotonicNanos() - from) / MS

/** Waits up to \`ms\` for a signal, and answers whether the watch should stop. */
const pause = (w: Watch, ms: i32): boolean => {
  if (w.stop === 0 && pollWait(w.loop, w.ready, ms) > 0) {
    const signal: i32 = readSignal(w.signals)
    w.stop = signal > 0 ? signal : 15
  }
  // The \`nish run --watch\` that started this one is gone, so nothing is left
  // to print to or to stop the watch: it stops as a hangup would stop it.
  if (w.stop === 0 && kill(w.driver, 0) < 0) {
    w.stop = 1
  }
  return w.stop !== 0
}

/** The exit status of \`pid\` once it has exited, or -1 while it runs. */
const reap = (pid: i32): i32 => {
  const r: i32[] = waitPid(pid, 1)
  if (r[0] === pid) {
    return r[1]
  }
  return r[0] < 0 ? 0 : -1
}

/** SIGTERM, up to \`GRACE_MS\` to exit, then SIGKILL; a signal to the watch cuts the grace short. */
const stopProcess = (w: Watch, pid: i32): void => {
  const asked: i32 = w.stop
  kill(pid, 15)
  const from: i64 = monotonicNanos()
  while (reap(pid) < 0) {
    if (millisSince(from) >= GRACE_MS || (asked === 0 && w.stop !== 0)) {
      kill(pid, 9)
      waitPid(pid, 0)
      return
    }
    if (w.stop === 0) {
      pause(w, 20)
    } else if (pollWait(w.loop, w.ready, 20) > 0) {
      // A second signal while stopping: read it, or the poll returns at once.
      readSignal(w.signals)
    }
  }
}

/** Stops the build in progress, whose files have changed since it began. */
const stopBuilder = (w: Watch): void => {
  if (w.builder > 0) {
    kill(w.builder, 15)
    waitPid(w.builder, 0)
    w.builder = 0
  }
}

const startProgram = (w: Watch, binary: string): i32 => {
  const argv: string[] = ["env", "NISH_WATCH=1", binary]
  for (const arg of w.args) {
    argv.push(arg)
  }
  const pid: i32 = spawn(argv)
  if (pid < 0) {
    console.error("watch: could not start " + binary)
    return 0
  }
  return pid
}

/** Whether a watched file changed since the last look; the stamps move on to what is there now. */
const changed = (w: Watch): boolean => {
  let any = false
  for (let i: i32 = 0; i < toI32(w.files.length); i++) {
    const now: f64 = stampOf(w.files[i])
    if (now !== w.stamps[i]) {
      w.stamps[i] = now
      any = true
    }
  }
  return any
}

/** The watched files from a build's state, each keeping the stamp it had when the build began. */
const watchFiles = (w: Watch, lines: string[]): void => {
  const files: string[] = []
  const stamps: f64[] = []
  for (let i: i32 = 2; i < toI32(lines.length); i++) {
    const file: string = lines[i]
    if (file.length > 0) {
      let stamp: f64 = -2
      for (let j: i32 = 0; j < toI32(w.files.length); j++) {
        if (w.files[j] === file) {
          stamp = w.stamps[j]
        }
      }
      files.push(file)
      stamps.push(stamp === -2 ? stampOf(file) : stamp)
    }
  }
  if (files.length > 0) {
    w.files = files
    w.stamps = stamps
  }
}

const swap = (w: Watch, binary: string, server: boolean): void => {
  // Started beside the old one only when both are servers: a program that
  // just became one would otherwise run beside an old one that is not.
  const beside: boolean = w.server && server
  w.server = server
  if (w.program > 0 && beside) {
    // A server: the new one binds beside the old with SO_REUSEPORT, so it is
    // started first, and the old one is stopped once the new one has lasted.
    const next: i32 = startProgram(w, binary)
    if (next === 0) {
      return
    }
    pause(w, SETTLE_MS)
    const early: i32 = reap(next)
    if (early >= 0) {
      console.error(\`watch: the new build exited with status \${early} as it started; the old one keeps running\`)
      return
    }
    stopProcess(w, w.program)
    w.program = next
    return
  }
  if (w.program > 0) {
    stopProcess(w, w.program)
  }
  w.program = startProgram(w, binary)
}

const finishBuild = (w: Watch, status: i32): void => {
  const took: i64 = millisSince(w.builtFrom)
  const keeps: string = w.program > 0 ? "the running program keeps running" : "waiting for a change"
  if (status !== 0) {
    console.error("watch: the build failed; " + keeps)
    return
  }
  const text: string | null = readFileSyncOrNull(w.state)
  const lines: string[] = text === null ? [] : splitLines(text)
  if (lines.length < 2 || lines[0].length === 0) {
    console.error("watch: the build left no binary; " + keeps)
    return
  }
  watchFiles(w, lines)
  console.error(\`watch: \${w.builds === 0 ? "built" : "rebuilt"} in \${took} ms\`)
  w.builds = w.builds + 1
  swap(w, lines[0], lines[1] === "1")
}

export const main = (): number => {
  const argv: string[] = process.argv
  if (argv.length < 6) {
    console.error("watch: started without its arguments; run it as \`nish run --watch <file.ts>\`")
    return 2
  }
  const w = new Watch()
  w.driver = parseInt(argv[1])
  w.state = argv[2]
  w.files = [argv[3]]
  w.stamps = [stampOf(argv[3])]
  const count: i32 = parseInt(argv[4])
  for (let i: i32 = 5; i < toI32(argv.length); i++) {
    if (i < 5 + count) {
      w.build.push(argv[i])
    } else {
      w.args.push(argv[i])
    }
  }
  w.signals = signalFd()
  w.loop = pollCreate()
  if (w.signals < 0 || w.loop < 0 || pollAdd(w.loop, w.signals, 1, 1) < 0) {
    console.error("watch: cannot listen for Ctrl-C")
    return 3
  }
  w.due = monotonicNanos()
  while (w.stop === 0) {
    if (w.builder === 0 && w.pending && monotonicNanos() >= w.due) {
      w.pending = false
      w.builtFrom = monotonicNanos()
      w.builder = spawn(w.build)
      if (w.builder < 0) {
        console.error("watch: could not start the build")
        w.builder = 0
      }
    }
    if (pause(w, POLL_MS)) {
      break
    }
    if (w.builder > 0) {
      const built: i32 = reap(w.builder)
      if (built >= 0) {
        w.builder = 0
        finishBuild(w, built)
      }
    }
    if (w.program > 0) {
      const exited: i32 = reap(w.program)
      if (exited >= 0) {
        w.program = 0
        console.error(\`watch: the program exited with status \${exited}; waiting for a change\`)
      }
    }
    if (changed(w)) {
      w.pending = true
      w.due = monotonicNanos() + DEBOUNCE_MS * MS
      stopBuilder(w)
    }
  }
  stopBuilder(w)
  if (w.program > 0) {
    stopProcess(w, w.program)
  }
  // The state file and the driver's pid file beside it: a Ctrl-C ends the
  // driver too, before it can remove them.
  unlinkSync(w.state)
  unlinkSync(w.state.slice(0, toI32(w.state.length) - 6))
  return 128 + w.stop
}
`
