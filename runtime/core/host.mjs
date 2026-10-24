/**
 * The host the core runs on (WP33 R3). Everything a program asks of the world
 * outside it — its output, its exit, its arguments, its files, its environment,
 * its children and its clocks — goes through one installed host object:
 *
 *   {
 *     writeOut(s), writeErr(s): write `s` to stdout or stderr, synchronously;
 *     exit(code): end the process with `code` and never return;
 *     argv(): the program then its arguments, as `process.argv` is under Nish;
 *     call(name, args): the host-bound builtin `name`, applied to `args`;
 *   }
 *
 * `runtime/node.mjs` installs Node's on import. Until a host is installed every
 * member throws a `NishNoHost` naming what was asked for, so a core loaded on
 * its own fails loudly rather than writing nowhere.
 *
 * The functions that have no synchronous reading under Node (`spawn`,
 * `waitPid`, `signalFd`, `readSignal`, the `nish:net` set) throw here without
 * asking any host.
 */

/** What every member of the default host throws: no adapter has been imported. */
export class NishNoHost extends Error {
  constructor(name) {
    super(`\`${name}\` needs a host, and none is installed: import runtime/node.mjs (or another adapter) first`);
    this.name = "NishNoHost";
    this.requested = name;
  }
}

const NO_HOST = {
  writeOut() {
    throw new NishNoHost("writeOut");
  },
  writeErr() {
    throw new NishNoHost("writeErr");
  },
  exit() {
    throw new NishNoHost("exit");
  },
  argv() {
    throw new NishNoHost("argv");
  },
  call(name) {
    throw new NishNoHost(name);
  },
};

let host = NO_HOST;

/** Make `next` the host every later call goes through. */
export function installHost(next) {
  host = next;
}

/** `console.log(x)`: `String(x)` (no `n` suffix for i64) plus a newline, written synchronously. */
export function log(x) {
  host.writeOut(`${String(x)}\n`);
}

/** `console.error(x)`: the same, on stderr. */
export function error(x) {
  host.writeErr(`${String(x)}\n`);
}

/** `write(s)` / `writeError(s)`: the bytes as they are, no trailing newline. */
export function write(s) {
  host.writeOut(s);
}

export function writeError(s) {
  host.writeErr(s);
}

/** `panic(message)`: the message on stderr, then exit 1. */
export function panic(message) {
  host.writeErr(`${message}\n`);
  host.exit(1);
}

/**
 * `process.exit(code)`: libc `exit` truncates to 8 bits exactly like Node does.
 * The code is converted as an index is (`sext` from i32, truncation from f64).
 */
export function exit(code) {
  host.exit(typeof code === "bigint" ? Number(code) : Math.trunc(code));
}

/** `process.argv`: index 0 is the program (the script here, the executable natively), then the arguments. */
export function argv() {
  return host.argv();
}

// ---- The host-bound builtins ----------------------------------------------------
//
// Each is the installed host's answer, under the same name and with the same
// arguments; what each answers is written beside its Node body in
// `runtime/node.mjs`.

export function readFileSync(path) {
  return host.call("readFileSync", [path]);
}

export function readFileSyncOrNull(path) {
  return host.call("readFileSyncOrNull", [path]);
}

export function readFileBytesSync(path) {
  return host.call("readFileBytesSync", [path]);
}

export function writeFileSync(path, data) {
  return host.call("writeFileSync", [path, data]);
}

export function appendFileSync(path, data) {
  return host.call("appendFileSync", [path, data]);
}

export function mkdirSync(path) {
  return host.call("mkdirSync", [path]);
}

export function isDirectorySync(path) {
  return host.call("isDirectorySync", [path]);
}

export function readdirSync(path) {
  return host.call("readdirSync", [path]);
}

export function realpathSync(path) {
  return host.call("realpathSync", [path]);
}

export function platform() {
  return host.call("platform", []);
}

export function arch() {
  return host.call("arch", []);
}

export function getenv(name) {
  return host.call("getenv", [name]);
}

export function spawnSync(argv) {
  return host.call("spawnSync", [argv]);
}

export function spawnSyncTo(argv, out, err) {
  return host.call("spawnSyncTo", [argv, out, err]);
}

export function kill(pid, sig) {
  return host.call("kill", [pid, sig]);
}

export function availableParallelism() {
  return host.call("availableParallelism", []);
}

export function totalMemory() {
  return host.call("totalMemory", []);
}

export function monotonicNanos() {
  return host.call("monotonicNanos", []);
}

export function statMtimeSync(path) {
  return host.call("statMtimeSync", [path]);
}

export function lstatOwnerModeSync(path) {
  return host.call("lstatOwnerModeSync", [path]);
}

export function geteuid() {
  return host.call("geteuid", []);
}

export function isExecutableSync(path) {
  return host.call("isExecutableSync", [path]);
}

export function isTerminal(fd) {
  return host.call("isTerminal", [fd]);
}

export function terminalSize() {
  return host.call("terminalSize", []);
}

// ---- Randomness ----------------------------------------------------------------

/**
 * The host's own fill, taken from the web `crypto` global before
 * `runtime/nish.mjs` puts the one below in its place on the same object.
 */
const webRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);

/**
 * `crypto.getRandomValues(bytes)` for the plain array a `u8[]` is here. The
 * web's own takes only a typed array, so the bytes are drawn into one and copied
 * across. More than 65,536 fails with the native panic and its words, where
 * the web's would throw a `QuotaExceededError`: the exit status is 1 either
 * way. A typed array goes straight through.
 */
export function getRandomValues(bytes) {
  if (!Array.isArray(bytes)) {
    return webRandom(bytes);
  }
  if (bytes.length > 65536) {
    panic(`crypto.getRandomValues: ${bytes.length} bytes asked for, and one call fills at most 65536`);
  }
  const drawn = webRandom(new Uint8Array(bytes.length));
  for (let i = 0; i < drawn.length; i++) {
    bytes[i] = drawn[i];
  }
  return bytes;
}

// ---- No synchronous reading ------------------------------------------------------

/**
 * `spawn(argv)` and `waitPid(pid, flags)` (WP34 N12) have no faithful reading
 * under Node, for `signalFd`'s reason: Node reaps its children itself, on the
 * event loop, and hands their status to an `exit` listener, so no synchronous
 * function here can wait for one, and a child Node started is never there for
 * a wait-less poll to find. Each throws, naming itself.
 */
function noProcessReading(name) {
  throw new Error(
    `\`${name}\` has no synchronous reading under Node: a child is reaped by the event loop, which a synchronous wait never returns to (docs/wp33-round-trip.md)`
  );
}

export function spawn() {
  return noProcessReading("spawn");
}

export function waitPid() {
  return noProcessReading("waitPid");
}

/**
 * `signalFd()` and `readSignal(fd)` have no faithful reading under Node, and
 * these say so rather than answer something else. Node delivers a signal to
 * its event loop (`process.on("SIGTERM")`), and a blocking read keeps the loop
 * from ever running, so no synchronous function here can learn that one
 * arrived. docs/wp33-round-trip.md §3.5 has the row and the translation.
 */
export function signalFd() {
  throw new Error(
    "signalFd has no synchronous reading under Node: a signal reaches the event loop, which a blocking readSignal never returns to (docs/wp33-round-trip.md)"
  );
}

export function readSignal() {
  return signalFd();
}

/**
 * The `nish:net` functions (WP34 N5) have no faithful reading under Node
 * either, for `signalFd`'s reason: Node's sockets are asynchronous only, and a
 * socket becomes readable, writable or connected only to the event loop, which
 * a program that owns its loop and spins or blocks in it never returns to. So
 * each throws, naming itself, rather than answer -11 forever; `nish.mjs`
 * installs one per name.
 * docs/wp33-round-trip.md is the note that asks for one stated answer.
 */
export function noNetReading(name) {
  throw new Error(
    `\`${name}\` has no synchronous reading under Node: a socket is ready only to the event loop, which a program that owns its loop never returns to (docs/wp33-round-trip.md)`
  );
}

/**
 * `readStdin`, `waitStdin` and `setRawMode` (`nish:term`) throw too, naming
 * themselves, for `noNetReading`'s reason: Node reads stdin only to its event
 * loop, and its own raw mode turns Ctrl-C into a byte, which is not the native
 * answer. `setTerminalRestore` throws as well: the bytes go out from the
 * native runtime's exit and signal paths, which a Node process does not run. The core exports one per name, for `--emit-ts` output to import, and
 * `nish.mjs` installs one per name as a global.
 */
export function noTermReading(name) {
  throw new Error(
    `\`${name}\` has no synchronous reading under Node: stdin is read only by the event loop, which a program that owns its loop never returns to (docs/RUN_UNDER_NODE.md)`
  );
}

export function readStdin() {
  return noTermReading("readStdin");
}

export function waitStdin() {
  return noTermReading("waitStdin");
}

export function setRawMode() {
  return noTermReading("setRawMode");
}

export function setTerminalRestore() {
  throw new Error(
    "`setTerminalRestore` has no reading under Node: its bytes go out from the native runtime's exit, panic and signal paths, which a Node process does not run (docs/RUN_UNDER_NODE.md)"
  );
}
