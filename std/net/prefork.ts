/**
 * `nish/net/prefork` — run a server on every core: a supervisor process that
 * starts one worker process per core, restarts one that dies, and stops them
 * all on SIGTERM or SIGINT (`docs/wp42-multicore-server.md` §2.3).
 *
 *     import { preforkWorkers } from "nish/net/prefork";
 *
 *     export const main = (): number => {
 *       const worker: i32 = preforkWorkers(process.argv);
 *       if (worker < 0) { return worker === -1 ? 0 : 1; } // the supervisor, done
 *       const listener = tcpListenFlags("0.0.0.0", 8080, 1024, 1); // SO_REUSEPORT
 *       // ... the single-threaded readiness loop, unchanged ...
 *     };
 *
 * **One program, two roles.** `preforkWorkers(process.argv)` answers in two kinds of
 * process. In a worker it answers the worker's index, `0` to `N - 1`, at once,
 * and the program goes on to bind its listener and serve. In the process the
 * user started it supervises, and answers only once every worker has exited:
 * `-1` after a shutdown, `-2` when the workers could not be started. Each worker
 * binds its own listener with `tcpListenFlags`' flag 1 (`SO_REUSEPORT`), so on
 * Linux the kernel spreads new connections across them and no state is shared:
 * a worker is the single-threaded server it was before, `Arena.used()` flat
 * per worker.
 *
 * **How a worker is told.** The supervisor runs the program again with
 * `--nish-prefork-worker=<index>` appended to its arguments, through `spawn`;
 * on Linux it runs `/proc/self/exe`, so a program started through `PATH` or a
 * relative path finds itself. `preforkArgs(process.argv)` answers the
 * arguments without that flag, for a worker that reads its own; the module
 * takes `process.argv` from its caller because only a program with a `main`
 * has one. The environment is inherited whole, and every descriptor the
 * supervisor holds is close-on-exec, so a worker starts with none of them
 * (`docs/security/runtime.md`, RT-17, RT-19).
 *
 * **How many.** `NISH_WORKERS` when it is a positive whole number, else
 * `PreforkConfig.workers` when that is positive, else
 * `availableParallelism()` on Linux and 1 elsewhere: Darwin shares a
 * `SO_REUSEPORT` port without spreading connections across it.
 *
 * **Restarts.** A worker that exits, by a signal or with any code, is started
 * again at the same index while the supervisor is not stopping. One that dies
 * within `quickExitMs` of starting waits before its restart: `backoffMs` the
 * first time, twice the last wait after that, up to `backoffCapMs`; one that
 * ran longer starts again at once and clears its wait, so a crash loop costs a
 * spawn every `backoffCapMs`, not a core.
 *
 * **Shutdown.** The supervisor listens through `signalFd()`, made before the
 * first spawn so no signal falls between. On SIGTERM or SIGINT it stops
 * restarting, sends every worker SIGTERM, reaps them for `graceMs`, sends what
 * is left SIGKILL and reaps that. A second signal during the grace period sends
 * SIGKILL at once. The workers get the default dispositions back from `exec`,
 * so a worker that never asked for `signalFd()` ends on the SIGTERM.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */
import { netClose, pollAdd, pollCreate, pollWait } from "nish:net"
import {
  availableParallelism,
  getenv,
  kill,
  monotonicNanos,
  platform,
  readSignal,
  signalFd,
  spawn,
  waitPid,
} from "nish:process"

/** The argument a worker is started with, its index after the `=`. */
export const PREFORK_WORKER_FLAG: string = "--nish-prefork-worker="

/** What `preforkWith` answers in the supervisor once its workers are gone. */
export const PREFORK_STOPPED: i32 = -1
/** What `preforkWith` answers when a worker could not be started. */
export const PREFORK_SPAWN_FAILED: i32 = -2

/** The supervisor's numbers; every one is checked by `preforkWith`. */
export class PreforkConfig {
  /** Workers to start; 0 takes `NISH_WORKERS` or the platform's default. */
  workers: i32 = 0
  /** How often, in milliseconds, the supervisor reaps when nothing wakes it. */
  tickMs: i32 = 100
  /** The first wait before restarting a worker that died young. */
  backoffMs: i32 = 100
  /** The longest wait before a restart. */
  backoffCapMs: i32 = 5000
  /** A worker that exits within this many milliseconds of starting died young. */
  quickExitMs: i32 = 1000
  /** How long the workers get to exit after SIGTERM before SIGKILL. */
  graceMs: i32 = 5000
}

/** True when `s` is one or more ASCII digits and nothing else. */
const preforkDigits = (s: string): boolean => {
  if (s.length === 0 || s.length > 9) {
    return false
  }
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    const c: i32 = toI32(s.charCodeAt(i))
    if (c < 48 || c > 57) {
      return false
    }
  }
  return true
}

/**
 * How many workers to start: `env` (`NISH_WORKERS`, `null` when unset) when it
 * is a positive whole number, else `requested` when positive, else the
 * platform's default.
 */
export const preforkWorkerCount = (requested: i32, env: string | null): i32 => {
  if (env !== null && preforkDigits(env)) {
    const n: i32 = parseInt(env)
    if (n > 0) {
      return n
    }
  }
  if (requested > 0) {
    return requested
  }
  if (platform !== "linux") {
    return 1
  }
  const cores: i32 = availableParallelism()
  return cores > 0 ? cores : 1
}

/** The worker index `args` carries in its last element, or -1 when none. */
export const preforkIndex = (args: string[]): i32 => {
  if (args.length < 2) {
    return -1
  }
  const last: string = args[args.length - 1]
  if (!last.startsWith(PREFORK_WORKER_FLAG)) {
    return -1
  }
  const digits: string = last.substring(PREFORK_WORKER_FLAG.length)
  return preforkDigits(digits) ? parseInt(digits) : -1
}

/** `args` (`process.argv`) without the worker flag, the same in every process. */
export const preforkArgs = (args: string[]): string[] => {
  const keep: i32 = preforkIndex(args) >= 0 ? toI32(args.length) - 1 : toI32(args.length)
  const out: string[] = []
  for (let i: i32 = 0; i < toI32(args.length); i++) {
    if (i < keep) {
      out.push(args[i])
    }
  }
  return out
}

/** Milliseconds on the monotonic clock. */
const preforkNowMs = (): i64 => monotonicNanos() / 1000000

/** The signals the supervisor stops its workers with. */
const PREFORK_SIGTERM: i32 = 15
const PREFORK_SIGKILL: i32 = 9

/** One worker's slot in the supervisor. */
class PreforkSlot {
  /** When the running worker started, or when the waiting one may start. */
  at: i64 = 0
  /** The running worker's pid, 0 while it waits to be started again. */
  pid: i32 = 0
  /** The wait before the last restart, 0 after a worker that ran long. */
  delay: i32 = 0
}

/** The supervisor's state while it runs. */
class PreforkSupervisor {
  config: PreforkConfig
  program: string
  args: string[]
  slots: PreforkSlot[]
  running: i32 = 0

  constructor(config: PreforkConfig, args: string[], count: i32) {
    this.config = config
    this.args = preforkArgs(args)
    const self: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null
    this.program = self !== null ? self : this.args[0]
    this.slots = []
    for (let i: i32 = 0; i < count; i++) {
      this.slots.push(new PreforkSlot())
    }
  }

  /** Start worker `index`; false when `spawn` refused. */
  start(index: i32): boolean {
    const argv: string[] = [this.program]
    for (let i: i32 = 1; i < toI32(this.args.length); i++) {
      argv.push(this.args[i])
    }
    argv.push(`${PREFORK_WORKER_FLAG}${index}`)
    const pid: i32 = spawn(argv)
    if (pid <= 0) {
      return false
    }
    const slot: PreforkSlot = this.slots[index]
    slot.pid = pid
    slot.at = preforkNowMs()
    this.running = this.running + 1
    return true
  }

  /** The slot `pid` ran in, or -1. */
  find(pid: i32): i32 {
    for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
      if (this.slots[i].pid === pid) {
        return i
      }
    }
    return -1
  }

  /**
   * Reap every worker that has exited. Unless `stopping`, each one's slot is
   * given the time it may start again.
   */
  reap(stopping: boolean): void {
    while (this.running > 0) {
      const done: i32[] = waitPid(-1, 1)
      if (done[0] === -4) {
        continue
      }
      if (done[0] <= 0) {
        return
      }
      const index: i32 = this.find(done[0])
      if (index < 0) {
        continue
      }
      const slot: PreforkSlot = this.slots[index]
      this.running = this.running - 1
      slot.pid = 0
      if (stopping) {
        continue
      }
      const now: i64 = preforkNowMs()
      if (now - slot.at < toI64(this.config.quickExitMs)) {
        const cap: i32 = this.config.backoffCapMs
        // Compared before doubling, so a cap near the i32 limit cannot overflow.
        slot.delay = slot.delay === 0 ? this.config.backoffMs : slot.delay > cap / 2 ? cap : slot.delay * 2
      } else {
        slot.delay = 0
      }
      slot.at = now + toI64(slot.delay)
    }
  }

  /** Start every waiting worker whose time has come; false when one failed. */
  restart(): boolean {
    const now: i64 = preforkNowMs()
    for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
      const slot: PreforkSlot = this.slots[i]
      if (slot.pid === 0 && slot.at <= now && !this.start(i)) {
        return false
      }
    }
    return true
  }

  /** Send `sig` to every running worker. */
  signal(sig: i32): void {
    for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
      if (this.slots[i].pid > 0) {
        kill(this.slots[i].pid, sig)
      }
    }
  }

  /** SIGTERM, reap until `graceMs` or a second signal, SIGKILL, reap. */
  stop(loop: i32, signals: i32, ready: i32[]): void {
    this.signal(PREFORK_SIGTERM)
    const deadline: i64 = preforkNowMs() + toI64(this.config.graceMs)
    this.reap(true)
    let forced = false
    while (this.running > 0 && !forced && preforkNowMs() < deadline) {
      const n: i32 = pollWait(loop, ready, this.config.tickMs)
      if (n > 0) {
        readSignal(signals)
        forced = true
      }
      this.reap(true)
    }
    if (this.running > 0) {
      this.signal(PREFORK_SIGKILL)
      while (this.running > 0) {
        const done: i32[] = waitPid(-1, 0)
        const index: i32 = done[0] > 0 ? this.find(done[0]) : -1
        if (index >= 0) {
          this.slots[index].pid = 0
          this.running = this.running - 1
        } else if (done[0] !== -4) {
          return
        }
      }
    }
  }
}

/** The first field of `config` the supervisor cannot run with, or "" when none. */
const preforkInvalid = (config: PreforkConfig): string => {
  if (config.workers < 0) {
    return "workers below 0"
  }
  if (config.tickMs <= 0) {
    return "tickMs not above 0"
  }
  if (config.backoffMs < 0 || config.backoffCapMs < config.backoffMs) {
    return "backoffMs below 0 or above backoffCapMs"
  }
  if (config.quickExitMs < 0 || config.graceMs < 0) {
    return "quickExitMs or graceMs below 0"
  }
  return ""
}

/**
 * In a worker, its index. In the supervisor, run the workers until SIGTERM or
 * SIGINT and answer `PREFORK_STOPPED`, or `PREFORK_SPAWN_FAILED` when one could
 * not be started (those already started are stopped first). Panics on a config
 * `preforkInvalid` names a field of.
 */
export const preforkWith = (args: string[], config: PreforkConfig): i32 => {
  const invalid: string = preforkInvalid(config)
  if (invalid !== "") {
    panic(`nish/net/prefork: ${invalid}`)
  }
  const index: i32 = preforkIndex(args)
  if (index >= 0) {
    return index
  }
  const signals: i32 = signalFd()
  const loop: i32 = pollCreate()
  if (signals < 0 || loop < 0 || pollAdd(loop, signals, 1, 0) < 0) {
    console.error("nish/net/prefork: cannot listen for SIGTERM")
    return PREFORK_SPAWN_FAILED
  }
  const supervisor = new PreforkSupervisor(config, args, preforkWorkerCount(config.workers, getenv("NISH_WORKERS")))
  const ready: i32[] = new Array<i32>(2)
  let result: i32 = PREFORK_STOPPED
  if (!supervisor.restart()) {
    console.error(`nish/net/prefork: cannot start ${supervisor.program}`)
    result = PREFORK_SPAWN_FAILED
  } else {
    let running = true
    while (running) {
      const n: i32 = pollWait(loop, ready, config.tickMs)
      if (n > 0) {
        readSignal(signals)
        running = false
      } else {
        supervisor.reap(false)
        if (!supervisor.restart()) {
          console.error(`nish/net/prefork: cannot restart ${supervisor.program}`)
          result = PREFORK_SPAWN_FAILED
          running = false
        }
      }
    }
  }
  supervisor.stop(loop, signals, ready)
  netClose(loop)
  return result
}

/** `preforkWith` with the default `PreforkConfig`. */
export const preforkWorkers = (args: string[]): i32 => preforkWith(args, new PreforkConfig())
