/**
 * `nish/net/prefork` — run a server on every core: a supervisor process that
 * starts one worker process per core, restarts one that dies, and stops them
 * all on SIGTERM or SIGINT (`docs/wp42-multicore-server.md` §2.3).
 *
 *     import { tcpListenFlags } from "nish:net";
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
 * `-1` after a shutdown, `-2` when the workers could not be started or the
 * supervisor could not listen for signals. Each worker binds its own listener
 * with `tcpListenFlags`' flag 1 (`SO_REUSEPORT`), so on Linux the kernel
 * spreads new connections across them and no state is shared:
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
 * but the channel ends below (`docs/security/runtime.md`, RT-17, RT-19).
 *
 * **Channels.** With `supervisorChannels` on, each worker is started with one
 * end of a fresh `unixSocketPair` (`channelKind`: stream by default, since a
 * seqpacket pair needs Linux and the supervisor panics on one elsewhere) and
 * the supervisor keeps the other; `preforkSupervise` hands each readable end to
 * a callback. With `serviceWorker` set, every other worker gets a pair to that
 * worker. The ends go through `spawnWithFds`, from descriptor 3 in a fixed
 * order: the supervisor channel, then a worker's service channel, or in the
 * service worker its end to each other worker by index, skipping its own.
 *
 *  Where they landed rides in `--nish-prefork-channels=` just before the worker
 *  flag, and `preforkSupervisorChannel`, `preforkServiceChannel` and
 *  `preforkServiceChannelOf` read it back. A pair cannot be handed to a worker
 *  already running, so service channels make the workers one group: when any of
 *  them exits, the supervisor sends the rest SIGTERM (SIGKILL after `graceMs`),
 *  and once none is left, starts them all again on fresh pairs, after the
 *  backoff of the one that exited first. No worker keeps an end whose peer is
 *  gone longer than that. With `restart` off nothing is signalled; a worker sees
 *  its peer's exit as a hang-up.
 *
 * **Listeners and pinning.** With `listenPort` set (0 or above), the supervisor
 * binds one `SO_REUSEPORT` listener per worker itself, in index order, keeps
 * them for its whole run and hands listener `k` to every start of worker `k`
 * after the channel ends; `preforkListener(args)` answers it in the worker
 * (`--nish-prefork-listener=`, before the channels flag), so a worker serves
 * that descriptor instead of binding its own. Port 0 binds the first listener
 * anywhere and the rest to its port.
 *
 *  With `pin` on as well, each listener steers by CPU (`tcpListenFlags`' flag
 *  4): the kernel hands a connection that arrived on CPU `k` to listener `k`,
 *  and a worker that is restarted takes the same listener, so the order holds
 *  across restarts, which it would not if each worker bound its own. `pin` alone
 *  makes each worker call `setCpuAffinity(k)` before `preforkWith` answers it,
 *  so worker `k` runs on CPU `k` only; a worker the kernel refuses (CPU `k`
 *  outside the process's mask) says so on stderr and runs unpinned.
 *
 *  More workers than `availableParallelism()` is refused with a panic, since a
 *  worker past the last CPU would be pinned nowhere and, steered, handed
 *  nothing. Pinning and steering are Linux's: elsewhere the supervisor says once
 *  that the workers run unpinned, and the listeners are plain `SO_REUSEPORT`
 *  ones. Both are off by default.
 *
 * **QUIC.** `listenUdp`, with `listenPort`, binds one UDP socket per worker
 * on the same port before the TCP listeners, held like them, as a group the
 * kernel steers by connection ID (`udpBind` flag 4): a datagram whose
 * destination ID starts with byte k reaches worker k. Worker k reads its
 * socket with `preforkUdpListener(args)` and the group's size N with
 * `preforkUdpCount(args)` (`--nish-prefork-udp=<fd>,<N>`, before the listener
 * flag), and sets `QuicServerConfig.workerIndex` to k and `.workerCount` to N
 * so every ID it issues starts with k. A connection then stays with its
 * worker when the client's address or port changes. More than 255 workers
 * panics; where the kernel refuses the steering (off Linux, or under a
 * seccomp profile that refuses it) the supervisor says so on stderr and runs
 * one worker.
 *
 * **How many.** `NISH_WORKERS` when it is a positive whole number, else
 * `PreforkConfig.workers` when that is positive, else
 * `availableParallelism()` on Linux and 1 elsewhere: Darwin shares a
 * `SO_REUSEPORT` port without spreading connections across it. The count has
 * no upper bound, so `NISH_WORKERS` is the operator's to set, not a client's.
 *
 * **Restarts.** A worker that exits, by a signal or with any code, is started
 * again at the same index while the supervisor is not stopping. One that dies
 * within `quickExitMs` of starting waits before its restart: `backoffMs` the
 * first time, twice the last wait after that, up to `backoffCapMs`; one that
 * ran longer starts again at once and clears its wait, so a crash loop costs a
 * spawn every `backoffCapMs`, not a core. A restart `spawn` refuses waits on
 * the same backoff and is tried again; only the first start of a worker that
 * fails ends the supervisor, with `PREFORK_SPAWN_FAILED`.
 *
 * **Shutdown.** The supervisor listens through `signalFd()`, made before the
 * first spawn so no signal falls between. On SIGTERM or SIGINT it stops
 * restarting, sends every worker SIGTERM, reaps them for `graceMs`, sends what
 * is left SIGKILL and reaps that. A second signal during the grace period sends
 * SIGKILL at once. The workers get the default dispositions back from `exec`,
 * so a worker that never asked for `signalFd()` ends on the SIGTERM. A
 * supervisor that dies any other way (SIGKILL, the OOM killer, or the default
 * action of SIGHUP or SIGQUIT, which `signalFd()` does not catch) leaves its
 * workers running, reparented to init.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */
import {
  NET_UNIX_SEQPACKET,
  NET_UNIX_STREAM,
  netClose,
  netLocalPort,
  netRead,
  pollAdd,
  pollCreate,
  pollWait,
  tcpListenFlags,
  udpBind,
  unixSocketPair,
} from "nish:net"
import {
  availableParallelism,
  getenv,
  kill,
  monotonicNanos,
  platform,
  readSignal,
  setCpuAffinity,
  signalFd,
  spawn,
  spawnWithFds,
  waitPid,
} from "nish:process"

/** The argument a worker is started with, its index after the `=`. */
export const PREFORK_WORKER_FLAG: string = "--nish-prefork-worker="
/**
 * The argument just before the worker flag when the worker has channels: the
 * descriptor of its supervisor channel, of its service channel, then in the
 * service worker of its end to each worker by index, comma-separated, `-1`
 * for none.
 */
export const PREFORK_CHANNELS_FLAG: string = "--nish-prefork-channels="
/**
 * The argument before the channels flag, or before the worker flag when there
 * is none, when the supervisor holds the listeners: the worker's listener's
 * descriptor.
 */
export const PREFORK_LISTENER_FLAG: string = "--nish-prefork-listener="
/**
 * The flag that hands a worker its UDP socket and the size of the steered
 * group, `<fd>,<N>`, before the listener flag, when `listenUdp` is on: read
 * it with `preforkUdpListener` and `preforkUdpCount`.
 */
export const PREFORK_UDP_FLAG: string = "--nish-prefork-udp="

/** What `preforkWith` answers in the supervisor once its workers are gone. */
export const PREFORK_STOPPED: i32 = -1
/**
 * What `preforkWith` answers when a worker could not be started, or when the
 * supervisor could not listen for SIGTERM and so starts none.
 */
export const PREFORK_SPAWN_FAILED: i32 = -2
/**
 * What `preforkWith` answers in the supervisor when `restart` is off and every
 * worker has exited.
 */
export const PREFORK_WORKERS_EXITED: i32 = -3

/** The supervisor's numbers; every one is checked by `preforkWith`. */
export class PreforkConfig {
  /** The address the listeners of `listenPort` bind. */
  listenHost: string = "0.0.0.0"
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
  /** The worker every other worker gets a socketpair to; -1 for none. */
  serviceWorker: i32 = -1
  /**
   * What every channel is: `NET_UNIX_STREAM` (1), or `NET_UNIX_SEQPACKET` (2),
   * which keeps each write one message but only Linux has. Stream is the
   * default because it works on Darwin too.
   */
  channelKind: i32 = 1
  /**
   * The port the supervisor binds one listener per worker on, 0 for any; -1,
   * the default, leaves each worker to bind its own.
   */
  listenPort: i32 = -1
  /** Their backlog. */
  listenBacklog: i32 = 1024
  /** Their `tcpListenFlags` beyond `SO_REUSEPORT`, which is always set: 0, or 2 for `TCP_NODELAY`. */
  listenFlags: i32 = 0
  /**
   * Start a worker that exited again. Off, a worker that exits stays gone,
   * and the supervisor returns once none is left.
   */
  restart: boolean = true
  /** Give each worker a socketpair to the supervisor (`preforkSupervise`). */
  supervisorChannels: boolean = false
  /**
   * Pin worker `k` to CPU `k` (`setCpuAffinity`), and with `listenPort`, steer
   * each connection to the listener of the CPU that received it. Linux only;
   * elsewhere the workers run unpinned. `k` is the CPU number, not the `k`-th
   * allowed CPU: under a mask that skips CPU `k`, worker `k` runs unpinned and
   * a connection received past the listeners falls back to the kernel's hash.
   */
  pin: boolean = false
  /**
   * With `listenPort`, also bind one UDP socket per worker on the same port,
   * before the TCP listeners, as a group the kernel steers by QUIC
   * connection ID (`udpBind` flag 4): a datagram goes to worker k when byte 0
   * of its destination connection ID is k, so a QUIC connection stays with
   * the worker that issued its IDs when the client's address changes. Linux
   * only, and at most 255 workers (more panics). Where the kernel refuses
   * the steering, the supervisor says so on stderr and runs one worker.
   */
  listenUdp: boolean = false
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
 *
 * @param requested the program's own choice, `PreforkConfig.workers`; 0 or
 *   less leaves it to the environment or the platform
 * @param env the raw `NISH_WORKERS` text, or `null` when it is unset; text
 *   that is not a positive whole number is ignored
 * @returns how many worker processes the supervisor starts, always 1 or more
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

/**
 * The worker index `args` carries in its last element, or -1 when none.
 *
 * @param args the process's arguments, `process.argv`
 * @returns this worker's index, 0 to `N - 1`, or -1 in the supervisor (or any
 *   process not started by one)
 */
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

/**
 * `args` (`process.argv`) without the worker flag and the channels,
 * listener and UDP flags before it, the same in every process.
 *
 * @param args the process's arguments, `process.argv`
 * @returns a new list of the arguments the user gave, without the flags the
 *   supervisor appended, so a worker reads the same ones the supervisor did
 */
export const preforkArgs = (args: string[]): string[] => {
  let keep: i32 = toI32(args.length)
  if (preforkIndex(args) >= 0) {
    keep = keep - 1
    if (keep > 1 && args[keep - 1].startsWith(PREFORK_CHANNELS_FLAG)) {
      keep = keep - 1
    }
    if (keep > 1 && args[keep - 1].startsWith(PREFORK_LISTENER_FLAG)) {
      keep = keep - 1
    }
    if (keep > 1 && args[keep - 1].startsWith(PREFORK_UDP_FLAG)) {
      keep = keep - 1
    }
  }
  const out: string[] = []
  for (let i: i32 = 0; i < toI32(args.length); i++) {
    if (i < keep) {
      out.push(args[i])
    }
  }
  return out
}

/** Field `at` of the channels flag in a worker's `args`, or -1. */
const preforkChannel = (args: string[], at: i32): i32 => {
  if (preforkIndex(args) < 0 || args.length < 3) {
    return -1
  }
  const flag: string = args[args.length - 2]
  if (!flag.startsWith(PREFORK_CHANNELS_FLAG)) {
    return -1
  }
  let rest: string = flag.substring(PREFORK_CHANNELS_FLAG.length)
  for (let k: i32 = 0; k < at; k++) {
    const comma: i32 = toI32(rest.indexOf(","))
    if (comma < 0) {
      return -1
    }
    rest = rest.substring(comma + 1)
  }
  const comma: i32 = toI32(rest.indexOf(","))
  const field: string = comma < 0 ? rest : rest.substring(0, comma)
  return preforkDigits(field) ? parseInt(field) : -1
}

/**
 * In a worker, its end of its supervisor channel; -1 when it has none.
 *
 * @param args the worker's arguments, `process.argv`
 * @returns the descriptor the worker talks to the supervisor through, or -1
 *   without `supervisorChannels` or outside a worker
 */
export const preforkSupervisorChannel = (args: string[]): i32 => preforkChannel(args, 0)

/**
 * In a worker, its end of its channel to the service worker; -1 in the service worker or when none.
 *
 * @param args the worker's arguments, `process.argv`
 * @returns the descriptor this worker reaches the service worker through, or -1
 */
export const preforkServiceChannel = (args: string[]): i32 => preforkChannel(args, 1)

/**
 * In the service worker, its end of the channel to worker `index`; -1 for itself or elsewhere.
 *
 * @param args the service worker's arguments, `process.argv`
 * @param index the other worker whose channel to look up, 0 to `N - 1`
 * @returns the descriptor the service worker reaches worker `index` through,
 *   or -1 for its own index, an index out of range, or any other process
 */
export const preforkServiceChannelOf = (args: string[], index: i32): i32 =>
  index < 0 || index > 2147483645 ? -1 : preforkChannel(args, 2 + index)

/**
 * In a worker, the listener the supervisor bound for it (`listenPort`); -1 when none.
 *
 * @param args the worker's arguments, `process.argv`
 * @returns the listening socket's descriptor to serve instead of binding one,
 *   or -1 when the worker should bind its own
 */
export const preforkListener = (args: string[]): i32 => {
  if (preforkIndex(args) < 0) {
    return -1
  }
  for (let back: i32 = 2; back <= 3 && back < toI32(args.length); back++) {
    const flag: string = args[toI32(args.length) - back]
    if (flag.startsWith(PREFORK_LISTENER_FLAG)) {
      const digits: string = flag.substring(PREFORK_LISTENER_FLAG.length)
      return preforkDigits(digits) ? parseInt(digits) : -1
    }
  }
  return -1
}

/** The most workers a steered UDP group may have: the steering reads one byte. */
const PREFORK_UDP_MAX: i32 = 255

/**
 * Field `at` (0 the descriptor, 1 the count) of a worker's well-formed UDP
 * flag, `<fd>,<N>` with N from 1 to `PREFORK_UDP_MAX`; -1 without one.
 */
const preforkUdpField = (args: string[], at: i32): i32 => {
  if (preforkIndex(args) < 0) {
    return -1
  }
  for (let back: i32 = 2; back <= 4 && back < toI32(args.length); back++) {
    const flag: string = args[toI32(args.length) - back]
    if (flag.startsWith(PREFORK_UDP_FLAG)) {
      const fields: string[] = flag.substring(PREFORK_UDP_FLAG.length).split(",")
      if (fields.length !== 2 || !preforkDigits(fields[0]) || !preforkDigits(fields[1])) {
        return -1
      }
      const count: i32 = parseInt(fields[1])
      if (count < 1 || count > PREFORK_UDP_MAX) {
        return -1
      }
      return at === 0 ? parseInt(fields[0]) : count
    }
  }
  return -1
}

/**
 * In a worker, the UDP socket the supervisor bound for it (`listenUdp`); -1
 * when none, or when the flag is not the supervisor's `<fd>,<N>`.
 *
 * @param args the worker's arguments, `process.argv`
 * @returns the bound UDP socket's descriptor to serve QUIC on, or -1
 */
export const preforkUdpListener = (args: string[]): i32 => preforkUdpField(args, 0)

/**
 * In a worker, how many workers share its steered UDP port (`listenUdp`): the
 * `QuicServerConfig.workerCount` to pair with `preforkIndex` as its
 * `workerIndex`. 0 exactly when `preforkUdpListener` answers -1.
 *
 * @param args the worker's arguments, `process.argv`
 * @returns the group's size, 1 to 255, or 0 without a UDP socket
 */
export const preforkUdpCount = (args: string[]): i32 => {
  const count: i32 = preforkUdpField(args, 1)
  return count > 0 ? count : 0
}

/**
 * The UDP group of `listenUdp`, socket i for worker i, bound before anything
 * else on the port: steered by connection ID (`udpBind` flag 4 with the count
 * in bits 8 to 15) for more than one worker. When the kernel refuses the
 * steering, one plain socket and a line on stderr, so the supervisor runs one
 * worker; empty, with a line on stderr and nothing left bound, when even that
 * cannot bind.
 */
const preforkBindUdp = (config: PreforkConfig, count: i32): i32[] => {
  const host: string = config.listenHost
  const out: i32[] = []
  const first: i32 = udpBind(host, config.listenPort, count > 1 ? 1 | 4 | (count << 8) : 1)
  if (first < 0 && count > 1) {
    const plain: i32 = udpBind(host, config.listenPort, 1)
    if (plain >= 0) {
      console.error(`nish/net/prefork: QUIC steering refused (${first}), running one worker`)
      out.push(plain)
      return out
    }
  }
  if (first < 0) {
    console.error(`nish/net/prefork: cannot bind UDP ${host}:${config.listenPort} (${first})`)
    return out
  }
  out.push(first)
  const port: i32 = config.listenPort === 0 ? netLocalPort(first) : config.listenPort
  for (let i: i32 = 1; i < count; i++) {
    const fd: i32 = udpBind(host, port, 1 | 4 | (count << 8))
    if (fd < 0) {
      console.error(`nish/net/prefork: cannot bind UDP ${host}:${port} (${fd})`)
      for (let j: i32 = 0; j < toI32(out.length); j++) {
        netClose(out[j])
      }
      return []
    }
    out.push(fd)
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
  /**
   * When the running worker started, or when the waiting one may start.
   *
   * @internal Read and set by `PreforkSupervisor`'s start, backoff and restart to time a worker's restart.
   */
  at: i64 = 0
  /**
   * The running worker's pid, 0 while it waits to be started again.
   *
   * @internal Read by `PreforkSupervisor` to match a reaped child to its slot and to signal it.
   */
  pid: i32 = 0
  /**
   * The wait before the last restart, 0 after a worker that ran long.
   *
   * @internal Read and set by `PreforkSupervisor.backoff` to double the wait after a quick exit.
   */
  delay: i32 = 0
  /**
   * The worker exited with `restart` off, and is never started again.
   *
   * @internal Read by `PreforkSupervisor`'s restarts so a worker that exited with `restart` off stays gone.
   */
  gone: boolean = false
  /**
   * The supervisor's end of the worker's channel, -1 when it has none.
   *
   * @internal Read by `preforkSupervise` to hand the end to the program's callback, and closed by `PreforkSupervisor.closeChannel`.
   */
  channel: i32 = -1
}

/** The supervisor's state while it runs. */
class PreforkSupervisor {
  private config: PreforkConfig
  /**
   * The executable each worker is spawned from: `/proc/self/exe` resolved on
   * Linux, else the program's first argument.
   *
   * @internal Read by `preforkSupervise` to name the program when its first
   *   start fails.
   */
  program: string
  private args: string[]
  /**
   * One slot per worker, by index.
   *
   * @internal Read by `preforkSupervise` to find a worker's channel from the
   *   token its readiness event carries.
   */
  slots: PreforkSlot[]
  /** While the group starts: each worker's end to the service worker, -1 for none. */
  private toService: i32[]
  /** While the group starts: the service worker's end to each worker, -1 for none. */
  private fromWorkers: i32[]
  /** When a group still running gets SIGKILL. */
  private cascadeAt: i64 = 0
  /**
   * How many workers are running now, started and not yet reaped.
   *
   * @internal Read by `preforkSupervise` to see when, with `restart` off,
   *   every worker has exited.
   */
  running: i32 = 0
  /** The readiness loop each supervisor channel is added to. */
  private loop: i32
  /** `config.serviceWorker`: with it at 0 or above, the workers are one group. */
  private service: i32
  /** The group is being stopped, to be started again once none of it is left. */
  private cascading: boolean = false
  /** Worker i's listener at i, held for the whole run; empty without `listenPort`. */
  private listeners: i32[]
  /**
   * Worker i's UDP socket at i, held for the whole run so its index in the
   * steered group never moves; empty without `listenUdp`.
   */
  private udp: i32[]

  /**
   * A supervisor with one empty slot per worker and no worker started yet.
   *
   * @param config the checked settings it runs by, kept and read throughout
   * @param args the supervisor's own arguments, `process.argv`, which every
   *   worker is started with
   * @param count how many workers to keep running
   * @param loop the readiness loop each supervisor channel is added to; the
   *   caller owns and closes it
   * @param udp the UDP group `preforkBindUdp` bound, one per worker, kept and
   *   closed with the listeners; empty without `listenUdp`
   */
  constructor(config: PreforkConfig, args: string[], count: i32, loop: i32, udp: i32[]) {
    this.config = config
    this.loop = loop
    this.udp = udp
    this.service = config.serviceWorker
    this.toService = []
    this.fromWorkers = []
    this.listeners = []
    this.args = preforkArgs(args)
    const self: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null
    this.program = self !== null ? self : this.args[0]
    this.slots = []
    // No end yet; typed so an f64 build still pushes an i32.
    const none: i32 = -1
    for (let i: i32 = 0; i < count; i++) {
      this.slots.push(new PreforkSlot())
      this.toService.push(none)
      this.fromWorkers.push(none)
    }
  }

  /**
   * Start worker `index` with its channel ends, the service ones from
   * `pairs`; false when a socketpair, the loop or the spawn refused it.
   */
  private start(index: i32): boolean {
    const fds: i32[] = []
    let own: i32 = -1
    if (this.config.supervisorChannels) {
      const pair: i32[] = [-1, -1]
      if (unixSocketPair(this.config.channelKind, pair) !== 0) {
        return false
      }
      // On the loop before the worker starts, so a refusal is a failed start.
      if (pollAdd(this.loop, pair[0], 1, index + 1) < 0) {
        netClose(pair[0])
        netClose(pair[1])
        return false
      }
      own = pair[0]
      fds.push(pair[1])
    }
    // Entry i of `fds` is the child's descriptor 3 + i.
    const fields: string[] = [own >= 0 ? "3" : "-1"]
    if (this.service >= 0 && index !== this.service) {
      fds.push(this.toService[index])
      fields.push(`${2 + fds.length}`)
    } else if (this.service >= 0) {
      fields.push("-1")
      for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
        if (i === index) {
          fields.push("-1")
        } else {
          fds.push(this.fromWorkers[i])
          fields.push(`${2 + fds.length}`)
        }
      }
    }
    const argv: string[] = [this.program]
    for (let i: i32 = 1; i < toI32(this.args.length); i++) {
      argv.push(this.args[i])
    }
    const channels: boolean = fds.length > 0
    if (this.udp.length > 0) {
      fds.push(this.udp[index])
      argv.push(`${PREFORK_UDP_FLAG}${2 + fds.length},${this.udp.length}`)
    }
    if (this.listeners.length > 0) {
      fds.push(this.listeners[index])
      argv.push(`${PREFORK_LISTENER_FLAG}${2 + fds.length}`)
    }
    if (channels) {
      argv.push(`${PREFORK_CHANNELS_FLAG}${fields.join(",")}`)
    }
    argv.push(`${PREFORK_WORKER_FLAG}${index}`)
    const pid: i32 = fds.length > 0 ? spawnWithFds(argv, fds) : spawn(argv)
    if (own >= 0) {
      netClose(fds[0])
    }
    if (pid <= 0) {
      if (own >= 0) {
        netClose(own)
      }
      return false
    }
    const slot: PreforkSlot = this.slots[index]
    if (own >= 0) {
      slot.channel = own
    }
    slot.pid = pid
    slot.at = preforkNowMs()
    this.running = this.running + 1
    return true
  }

  /** The slot `pid` ran in, or -1. */
  private find(pid: i32): i32 {
    for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
      if (this.slots[i].pid === pid) {
        return i
      }
    }
    return -1
  }

  /**
   * Give `slot` the time it may start again: at once after a worker that ran
   * at least `quickExitMs`, else, or when `failed` (`spawn` refused it), after
   * a wait that starts at `backoffMs` and doubles up to `backoffCapMs`.
   */
  private backoff(slot: PreforkSlot, now: i64, failed: boolean): void {
    if (failed || now - slot.at < toI64(this.config.quickExitMs)) {
      const cap: i32 = this.config.backoffCapMs
      if (slot.delay === 0) {
        slot.delay = this.config.backoffMs
      } else {
        // Compared before doubling, so a cap near the i32 limit cannot overflow.
        slot.delay = slot.delay > cap / 2 ? cap : slot.delay * 2
      }
    } else {
      slot.delay = 0
    }
    slot.at = now + toI64(slot.delay)
  }

  /**
   * Reap every worker that has exited. Unless `stopping`, each one's slot is
   * given the time it may start again. A child that is not a worker (one the
   * program spawned itself before calling `preforkWith`) is reaped too, and
   * its status is discarded. Answers false when `waitPid` fails, which means
   * no child is left to wait for.
   *
   * @internal Called by `preforkSupervise` on every tick, and by `stop`.
   */
  reap(stopping: boolean): boolean {
    while (this.running > 0) {
      const done: i32[] = waitPid(-1, 1)
      if (done[0] === -4) {
        continue
      }
      if (done[0] <= 0) {
        return done[0] === 0
      }
      const index: i32 = this.find(done[0])
      if (index < 0) {
        continue
      }
      const slot: PreforkSlot = this.slots[index]
      this.running = this.running - 1
      slot.pid = 0
      this.closeChannel(slot)
      if (!this.config.restart) {
        slot.gone = true
      } else if (!stopping) {
        const now: i64 = preforkNowMs()
        if (this.cascading) {
          // Stopped with its group, so it waits only on the group.
          slot.at = now
        } else {
          this.backoff(slot, now, false)
          if (this.service >= 0) {
            this.cascade(now)
          }
        }
      }
    }
    return true
  }

  /**
   * Close the supervisor's end of `slot`'s channel, which takes it off the loop.
   *
   * @internal Called by `preforkSupervise` after a channel hangs up.
   */
  closeChannel(slot: PreforkSlot): void {
    if (slot.channel >= 0) {
      netClose(slot.channel)
      slot.channel = -1
    }
  }

  /** Stop the group so it starts again whole: SIGTERM now, SIGKILL after `graceMs`. */
  private cascade(now: i64): void {
    this.cascading = true
    this.cascadeAt = now + toI64(this.config.graceMs)
    this.signal(PREFORK_SIGTERM)
  }

  /**
   * SIGKILL a stopping group that outlived `graceMs`, again each `graceMs`.
   *
   * @internal Called by `preforkSupervise` on every tick.
   */
  escalate(): void {
    if (!this.cascading || this.running <= 0) {
      return
    }
    const now: i64 = preforkNowMs()
    if (now >= this.cascadeAt) {
      this.cascadeAt = now + toI64(this.config.graceMs)
      this.signal(PREFORK_SIGKILL)
    }
  }

  /** A pair from each worker to the service worker; false when one failed. */
  private pairs(): boolean {
    for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
      if (i !== this.service) {
        const pair: i32[] = [-1, -1]
        if (unixSocketPair(this.config.channelKind, pair) !== 0) {
          return false
        }
        this.toService[i] = pair[0]
        this.fromWorkers[i] = pair[1]
      }
    }
    return true
  }

  /** Close every end `pairs` made: the workers hold their copies now. */
  private closePairs(): void {
    for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
      if (this.toService[i] >= 0) {
        netClose(this.toService[i])
        this.toService[i] = -1
      }
      if (this.fromWorkers[i] >= 0) {
        netClose(this.fromWorkers[i])
        this.fromWorkers[i] = -1
      }
    }
  }

  /**
   * With a service worker: once no worker of the group runs and the latest
   * slot's time has come, start them all on fresh pairs. A failure answers
   * false when `first`; otherwise it backs off the slot that failed and stops
   * the workers it started, to be tried again whole.
   */
  private restartGroup(first: boolean): boolean {
    if (this.running > 0) {
      return true
    }
    const now: i64 = preforkNowMs()
    let due: i64 = 0
    let waiting = false
    for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
      if (!this.slots[i].gone) {
        waiting = true
        due = this.slots[i].at > due ? this.slots[i].at : due
      }
    }
    if (!waiting || due > now) {
      return true
    }
    this.cascading = false
    let failed: i32 = this.pairs() ? -1 : this.service
    for (let i: i32 = 0; i < toI32(this.slots.length) && failed < 0; i++) {
      if (!this.start(i)) {
        failed = i
      }
    }
    this.closePairs()
    if (failed < 0) {
      return true
    }
    if (first) {
      return false
    }
    console.error(`nish/net/prefork: cannot restart the workers at worker ${failed}`)
    this.backoff(this.slots[failed], now, true)
    this.cascade(now)
    return true
  }

  /**
   * Start every waiting worker whose time has come. When `first`, answer false
   * at the first `spawn` that fails; otherwise a failed start waits on the
   * same backoff as a worker that exited at once, and the answer is true.
   *
   * @internal Called by `preforkSupervise` for the first start and on every tick.
   */
  restart(first: boolean): boolean {
    if (this.service >= 0) {
      return this.restartGroup(first)
    }
    const now: i64 = preforkNowMs()
    for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
      const slot: PreforkSlot = this.slots[i]
      if (slot.pid === 0 && !slot.gone && slot.at <= now && !this.start(i)) {
        if (first) {
          return false
        }
        console.error(`nish/net/prefork: cannot restart worker ${i}`)
        this.backoff(slot, now, true)
      }
    }
    return true
  }

  /**
   * One listener per worker, in index order, which is the order steering
   * counts CPUs in; false, with the ones made closed, when one cannot bind.
   *
   * @internal Called by `preforkSupervise` before the first start when `listenPort` is set.
   */
  listen(steer: boolean): boolean {
    const config: PreforkConfig = this.config
    const flags: i32 = config.listenFlags | 1 | (steer ? 4 : 0)
    // With `listenUdp`, port 0 was chosen by the UDP group, bound first.
    let port: i32 = config.listenPort === 0 && this.udp.length > 0 ? netLocalPort(this.udp[0]) : config.listenPort
    for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
      const fd: i32 = tcpListenFlags(config.listenHost, port, config.listenBacklog, flags)
      if (fd < 0) {
        console.error(`nish/net/prefork: cannot listen on ${config.listenHost}:${port} (${fd})`)
        this.closeListeners()
        return false
      }
      this.listeners.push(fd)
      if (port === 0) {
        port = netLocalPort(fd)
      }
    }
    return true
  }

  /**
   * Close the listeners `listen` made.
   *
   * @internal Called by `preforkSupervise` once the workers are stopped.
   */
  closeListeners(): void {
    for (let i: i32 = 0; i < toI32(this.listeners.length); i++) {
      netClose(this.listeners[i])
    }
    this.listeners = []
    for (let i: i32 = 0; i < toI32(this.udp.length); i++) {
      netClose(this.udp[i])
    }
    this.udp = []
  }

  /** Send `sig` to every running worker. */
  private signal(sig: i32): void {
    for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
      if (this.slots[i].pid > 0) {
        kill(this.slots[i].pid, sig)
      }
    }
  }

  /**
   * SIGTERM, reap until `graceMs` or a second signal, SIGKILL, reap until no
   * worker is left. Two signals that arrive before the supervisor reads the
   * first count as the second here too. Every reap goes through `reap`, so a
   * child that is not a worker is skipped in both phases, and the SIGKILL
   * phase ends only when the last worker is reaped or no child is left. The
   * supervisor's channel ends are closed first, so only `signals` wakes it.
   *
   * @internal Called by `preforkSupervise` once, on shutdown.
   */
  stop(loop: i32, signals: i32, ready: i32[]): void {
    for (let i: i32 = 0; i < toI32(this.slots.length); i++) {
      this.closeChannel(this.slots[i])
    }
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
      while (this.reap(true) && this.running > 0) {
        if (pollWait(loop, ready, this.config.tickMs) > 0) {
          readSignal(signals)
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
  if (config.backoffMs <= 0 || config.backoffCapMs < config.backoffMs) {
    return "backoffMs not above 0 or above backoffCapMs"
  }
  if (config.quickExitMs < 0 || config.graceMs < 0) {
    return "quickExitMs or graceMs below 0"
  }
  if (config.channelKind !== NET_UNIX_STREAM && config.channelKind !== NET_UNIX_SEQPACKET) {
    return "channelKind not NET_UNIX_STREAM or NET_UNIX_SEQPACKET"
  }
  const channels = config.supervisorChannels || config.serviceWorker >= 0
  if (channels && config.channelKind === NET_UNIX_SEQPACKET && platform !== "linux") {
    return "channelKind NET_UNIX_SEQPACKET: seqpacket channels need Linux"
  }
  if (config.serviceWorker < -1) {
    return "serviceWorker below -1"
  }
  if (config.listenPort < -1 || config.listenPort > 65535) {
    return "listenPort not -1 or 0..65535"
  }
  if (config.listenBacklog <= 0) {
    return "listenBacklog not above 0"
  }
  if (config.listenFlags !== 0 && config.listenFlags !== 2) {
    return "listenFlags not 0 or 2"
  }
  if (config.listenUdp && config.listenPort < 0) {
    return "listenUdp without listenPort"
  }
  return ""
}

/** Read and drop what a channel holds: `preforkWith`'s callback. */
const preforkDiscard = (buf: u8[], _index: i32, fd: i32, _events: i32): void => {
  const size: i32 = toI32(buf.length)
  while (netRead(fd, buf, 0, size) > 0) {
    // Dropped.
  }
}

/**
 * In a worker, its index. In the supervisor, run the workers until SIGTERM or
 * SIGINT and answer `PREFORK_STOPPED`; with `restart` off, also until every
 * worker has exited, answering `PREFORK_WORKERS_EXITED`; or
 * `PREFORK_SPAWN_FAILED` when a worker's
 * first start failed (those already started are stopped first) or no signal
 * listener could be made (no worker is started). Panics on a config
 * `preforkInvalid` names a field of. Supervisor channels are read and
 * dropped; `preforkSupervise` hands them to the program.
 *
 * @param args the process's arguments, `process.argv`
 * @param config the supervisor's settings, every field checked (a bad one
 *   panics) in the supervisor and each worker alike; past that check a
 *   worker reads only `pin`
 * @returns in a worker, its index at once; in the supervisor, once it is done,
 *   `PREFORK_STOPPED`, `PREFORK_WORKERS_EXITED` or `PREFORK_SPAWN_FAILED`
 */
export const preforkWith = (args: string[], config: PreforkConfig): i32 => {
  const buf: u8[] = new Array<u8>(512)
  return preforkSupervise(args, config, buf, preforkDiscard)
}

/**
 * `preforkWith`, calling `onChannel(state, index, fd, events)` in the
 * supervisor whenever worker `index`'s supervisor channel `fd` is readable or
 * hung up: `events` is `pollWait`'s, 1 readable and 4 added on a hang-up or
 * error. The callback reads what is waiting, since an end left readable wakes
 * the loop again at once, and may write back, but never closes `fd`: the
 * supervisor closes it after a hang-up, when the worker is reaped and when it
 * stops, and a restarted worker comes with a new one.
 *
 * Panics, besides, when `serviceWorker` is not below the worker count or the
 * count is above 64 with a service worker (63 with `listenPort`), the most
 * `spawnWithFds` hands one child; when `pin`, on Linux, asks for more workers
 * than `availableParallelism()`; when `listenUdp` asks for more than 255
 * workers (62 with a service worker); and, through `preforkInvalid`, on
 * seqpacket channels off Linux. A listener or UDP socket that cannot bind
 * answers `PREFORK_SPAWN_FAILED` before any worker starts.
 *
 * @param args the process's arguments, `process.argv`
 * @param config the supervisor's settings, every field checked (a bad one
 *   panics) in the supervisor and each worker alike; past that check a
 *   worker reads only `pin`
 * @param state the program's own value, passed to every `onChannel` call
 * @param onChannel what the supervisor runs when worker `index`'s channel
 *   `fd` wakes it, with `pollWait`'s `events`
 * @returns in a worker, its index at once; in the supervisor, once it is done,
 *   `PREFORK_STOPPED`, `PREFORK_WORKERS_EXITED` or `PREFORK_SPAWN_FAILED`
 */
export const preforkSupervise = <S>(
  args: string[],
  config: PreforkConfig,
  state: S,
  onChannel: (state: S, index: i32, fd: i32, events: i32) => void
): i32 => {
  const invalid: string = preforkInvalid(config)
  if (invalid !== "") {
    panic(`nish/net/prefork: ${invalid}`)
  }
  const pin: boolean = config.pin && platform === "linux"
  const index: i32 = preforkIndex(args)
  if (index >= 0) {
    const pinned: i32 = pin ? setCpuAffinity(index) : 0
    if (pinned < 0) {
      console.error(`nish/net/prefork: worker ${index} runs unpinned (${pinned})`)
    }
    return index
  }
  let count: i32 = preforkWorkerCount(config.workers, getenv("NISH_WORKERS"))
  if (config.listenUdp && count > PREFORK_UDP_MAX) {
    panic(`nish/net/prefork: listenUdp with ${count} workers, above ${PREFORK_UDP_MAX}`)
  }
  // A held listener is one more descriptor for every worker, the service one
  // too, and a held UDP socket one more again.
  const fdMax: i32 = (config.listenPort >= 0 ? 63 : 64) - (config.listenUdp ? 1 : 0)
  if (config.serviceWorker >= count || (config.serviceWorker >= 0 && count > fdMax)) {
    panic(`nish/net/prefork: serviceWorker not below ${count} workers, or above ${fdMax} workers`)
  }
  const cpus: i32 = pin ? availableParallelism() : 0
  if (pin && count > cpus) {
    panic(`nish/net/prefork: pin with ${count} workers on ${cpus} CPUs`)
  }
  if (config.pin && !pin) {
    console.error("nish/net/prefork: pinning needs Linux; the workers run unpinned")
  }
  const signals: i32 = signalFd()
  const loop: i32 = pollCreate()
  if (signals < 0 || loop < 0 || pollAdd(loop, signals, 1, 0) < 0) {
    // `signals` is the process's one signal pipe, which every later
    // `signalFd()` answers, so only the loop is closed.
    console.error("nish/net/prefork: cannot listen for SIGTERM")
    if (loop >= 0) {
      netClose(loop)
    }
    return PREFORK_SPAWN_FAILED
  }
  // The UDP group first: a refused steering runs one worker, so it decides
  // the count everything after it is made for.
  const udp: i32[] = config.listenUdp ? preforkBindUdp(config, count) : []
  if (config.listenUdp && udp.length === 0) {
    netClose(loop)
    return PREFORK_SPAWN_FAILED
  }
  if (config.listenUdp) {
    count = toI32(udp.length)
  }
  const supervisor = new PreforkSupervisor(config, args, count, loop, udp)
  if (config.listenPort >= 0 && !supervisor.listen(pin)) {
    netClose(loop)
    return PREFORK_SPAWN_FAILED
  }
  // Token 0 is the signal pipe, token i + 1 worker i's channel.
  const ready: i32[] = new Array<i32>(2 * count + 2)
  let result: i32 = PREFORK_STOPPED
  if (!supervisor.restart(true)) {
    console.error(`nish/net/prefork: cannot start ${supervisor.program}`)
    result = PREFORK_SPAWN_FAILED
  } else {
    let running = true
    while (running) {
      const n: i32 = pollWait(loop, ready, config.tickMs)
      for (let k: i32 = 0; k < n; k++) {
        const token: i32 = ready[2 * k]
        const events: i32 = ready[2 * k + 1]
        if (token === 0) {
          readSignal(signals)
          running = false
        } else if (supervisor.slots[token - 1].channel >= 0) {
          const slot: PreforkSlot = supervisor.slots[token - 1]
          onChannel(state, token - 1, slot.channel, events)
          if ((events & 4) !== 0) {
            supervisor.closeChannel(slot)
          }
        }
      }
      if (running) {
        supervisor.reap(false)
        if (!config.restart && supervisor.running === 0) {
          result = PREFORK_WORKERS_EXITED
          running = false
        }
        supervisor.escalate()
        supervisor.restart(false)
      }
    }
  }
  supervisor.stop(loop, signals, ready)
  supervisor.closeListeners()
  netClose(loop)
  return result
}

/**
 * `preforkWith` with the default `PreforkConfig`.
 *
 * @param args the process's arguments, `process.argv`
 * @returns in a worker, its index at once; in the supervisor, once it is done,
 *   `PREFORK_STOPPED` or `PREFORK_SPAWN_FAILED`
 */
export const preforkWorkers = (args: string[]): i32 => preforkWith(args, new PreforkConfig())
