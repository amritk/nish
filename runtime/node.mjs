/**
 * The Node host (WP33 R3): importing this module installs, into
 * `runtime/core/host.mjs`, the output, exit, arguments and host-bound builtins
 * Node gives a rewritten program. Output is written with `fs.writeSync`, so
 * `process.exit` cannot lose it. What each builtin answers, and where it parts
 * from the native runtime (runtime/runtime-os.c, runtime/runtime-host.c), is
 * written beside it.
 */
import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { installHost } from "./core/host.mjs";

function ioFail(verb, path) {
  fs.writeSync(2, `nish: cannot ${verb} ${path}\n`);
  process.exit(1);
}

function readFileSync(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    return ioFail("read", path);
  }
}

/** `readFileSyncOrNull(path)`: null instead of exiting, so the program decides. */
function readFileSyncOrNull(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** `readFileBytesSync(path)` (WP34 N2): the bytes as a plain array of numbers, or null. */
function readFileBytesSync(path) {
  try {
    return Array.from(fs.readFileSync(path));
  } catch {
    return null;
  }
}

/**
 * The flags `runtime-os.c` opens a file it writes with, `O_NOFOLLOW` included
 * (docs/security/runtime.md, RT-4): a symbolic link as the last component of
 * the path is refused rather than followed, so `writeFileSync`,
 * `appendFileSync` and `spawnSyncTo` fail here where they fail natively. Node's
 * `"w"` and `"a"` follow the link. A link among the directories on the way is
 * still followed, as it is natively. Windows has no `O_NOFOLLOW`, and there the
 * flag is 0.
 */
const { O_WRONLY, O_CREAT, O_TRUNC, O_APPEND, O_NOFOLLOW = 0 } = fs.constants;
const WRITE_FLAGS = O_WRONLY | O_CREAT | O_TRUNC | O_NOFOLLOW;
const APPEND_FLAGS = O_WRONLY | O_CREAT | O_APPEND | O_NOFOLLOW;

function writeFileSync(path, data) {
  try {
    fs.writeFileSync(path, data, { encoding: "utf8", flag: WRITE_FLAGS });
  } catch {
    ioFail("write", path);
  }
}

function appendFileSync(path, data) {
  try {
    fs.appendFileSync(path, data, { encoding: "utf8", flag: APPEND_FLAGS });
  } catch {
    ioFail("write", path);
  }
}

/**
 * `mkdirSync(path)` (WP14 D4): one directory, not recursive, answering whether
 * a directory is there afterwards. Node throws where the runtime answers
 * false, and `EEXIST` on a plain file is a failure here as it is there, so the
 * `statSync` decides rather than the exception.
 */
function mkdirSync(path) {
  try {
    fs.mkdirSync(path);
    return true;
  } catch {
    try {
      return fs.statSync(path).isDirectory();
    } catch {
      return false;
    }
  }
}

/**
 * `isDirectorySync(path)` (WP14 §7a): one stat, and a boolean out of it rather
 * than an exception, which is what the runtime's `stat` answers too.
 */
function isDirectorySync(path) {
  try {
    return fs.statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * `readdirSync(path)`: the entries, sorted ascending by bytes, or `null` when
 * the directory cannot be read. Node throws where the runtime answers a value,
 * so the `catch` is what makes the two agree, and a directory that exists and
 * is empty answers an empty array on both sides. Node's readdir never yields
 * `.` or `..` — the pair `runtime-os.c` skips explicitly — so there is nothing
 * to filter out here.
 *
 * The sort is the semantic point. `runtime-os.c` orders the names with
 * `strcmp`, which compares UTF-8 bytes, and `Array#sort` compares UTF-16 code
 * units. The two agree on ASCII names and part company above the BMP, where a
 * surrogate pair sorts below `U+E000`..`U+FFFF` in UTF-16 and above them in
 * UTF-8. So the comparison is over the encoded bytes, which is the native order
 * exactly rather than the native order for the names that happen to be ASCII.
 */
function readdirSync(path) {
  let names;
  try {
    names = fs.readdirSync(path);
  } catch {
    return null;
  }
  return names.sort((a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")));
}

/**
 * `realpathSync(path)` (WP19 §5a item 4): `path` with its symbolic links
 * resolved, or `null` when it does not resolve.
 *
 * `fs.realpathSync` throws where the native `realpath` answers NULL — a
 * missing path, a loop, a component that is not a directory — so the `catch`
 * is what makes the two runtimes agree, exactly as it does for `readdirSync`
 * above. Node's own answer is already absolute and already normalised, which
 * is what POSIX `realpath` guarantees, so nothing here has to normalise it.
 */
function realpathSync(path) {
  try {
    return fs.realpathSync(path);
  } catch {
    return null;
  }
}

/**
 * `process.platform` / `process.arch` (WP14 §7a). Node's spellings are the
 * ones `runtime-os.c` answers with, so on any machine this compiler has a
 * triple for the two runtimes give the same string; elsewhere the native build
 * says `unknown` where Node names the platform, which is the one place they
 * part.
 */
function platform() {
  return process.platform;
}

function arch() {
  return process.arch;
}

/**
 * `getenv(name)` (WP19 R1): the value, or `null` when the variable is unset.
 * Node answers `undefined` there and the language has no `undefined`, so the
 * `??` is what makes the two runtimes agree; an empty value stays an empty
 * string on both sides, because `CC=` is set and `CC` unset is not.
 */
function getenv(name) {
  return process.env[name] ?? null;
}

/**
 * `spawnSync(argv)` and `spawnSyncTo(argv, out, err)` (WP14 D4), which are one
 * run with its streams answered differently: the child's exit status, 128 + n
 * when signal n killed it, -1 for an empty vector or a program that would not
 * start. `runtime-os.c` puts one `static nish_spawn_impl` behind both builtins
 * for the same reason this module puts one function behind both helpers — the
 * argument vector, the wait and the signal convention are written once and
 * cannot drift between the two.
 *
 * `out` and `err` are paths for the child's stdout and stderr, and an **empty**
 * string leaves that stream inherited. Each file is created or truncated at
 * 0644 with `WRITE_FLAGS`, which is what the runtime's file actions ask for:
 * `O_WRONLY | O_CREAT | O_TRUNC | O_NOFOLLOW`, so a symbolic link at the path
 * is refused and the answer is -1, on both sides. The descriptors opened here are
 * closed again whichever way the child went; natively the child opens them and
 * its exit drops them.
 */
function spawnImpl(argv, out, err) {
  if (argv.length === 0) return -1;
  const opened = [];
  const stream = (target) => {
    if (target.length === 0) return "inherit";
    const fd = fs.openSync(target, WRITE_FLAGS, 0o644);
    opened.push(fd);
    return fd;
  };
  try {
    const r = child_process.spawnSync(argv[0], argv.slice(1), {
      stdio: ["inherit", stream(out), stream(err)],
    });
    if (r.error !== undefined) return -1;
    if (r.signal !== null && r.signal !== undefined) return 128 + (os.constants.signals[r.signal] ?? 0);
    return r.status === null ? -1 : r.status;
  } catch {
    // A path that cannot be opened is, natively, a file action the child could
    // not perform, and `posix_spawnp` reports that through its return value:
    // -1, with no child having run. Opening the second path is what can fail
    // after the first file was already created, so the truncation a caller can
    // observe happens on both sides.
    return -1;
  } finally {
    for (const fd of opened) fs.closeSync(fd);
  }
}

/** `spawnSync(argv)`: the child inherits this process's streams, as it does natively. */
function spawnSync(argv) {
  return spawnImpl(argv, "", "");
}

/** `spawnSyncTo(argv, stdoutPath, stderrPath)`: the same run with a stream sent to a file. */
function spawnSyncTo(argv, out, err) {
  return spawnImpl(argv, out, err);
}

/**
 * `kill(pid, sig)`: 0, or a negative errno, as `runtime-os.c`'s `nish_kill`
 * answers. Only 0, 2, 9 and 15 are sent and a pid of 0 or below is refused,
 * both -22, before Node is asked; Node's error then names its errno, which
 * `os.constants.errno` turns back into the number (-3 for no such process).
 */
function kill(pid, sig) {
  if (pid <= 0 || !(sig === 0 || sig === 2 || sig === 9 || sig === 15)) return -22;
  try {
    process.kill(pid, sig);
    return 0;
  } catch (e) {
    return -(os.constants.errno[e.code] ?? 22);
  }
}

/**
 * `availableParallelism()`: Node's own count, which reads the affinity mask as
 * the native one does, lowered by a positive `NISH_NUM_THREADS` the way the
 * native count is. The native count also reads a cgroup v2 CPU quota, which
 * Node does not, so inside a container with a quota the two may differ; both
 * are at least 1.
 */
function availableParallelism() {
  const n = os.availableParallelism();
  const want = /^[0-9]+$/.test(process.env.NISH_NUM_THREADS ?? "") ? Number(process.env.NISH_NUM_THREADS) : 0;
  return want > 0 && want < n ? want : n;
}

/** `totalMemory()`: `os.totalmem()`, as a BigInt because an `i64` is held as one here. */
function totalMemory() {
  return BigInt(os.totalmem());
}

/**
 * `monotonicNanos()`: `process.hrtime.bigint()`, a monotonic clock in
 * nanoseconds (`CLOCK_MONOTONIC` on every platform that has it, which is the
 * one `runtime-os.c` reads). The value is a BigInt because that is how an `i64`
 * is held on this side.
 *
 * No rewrite can make a *reading* agree with a native run: both origins are
 * arbitrary and neither is the other's. Only the difference between two reads
 * means anything, so a differential program may compare two readings and must
 * never print one.
 */
function monotonicNanos() {
  return process.hrtime.bigint();
}

/**
 * `statMtimeSync(path)`: Node's `mtimeMs` for the path, or NaN when it cannot
 * be stat'd, which is the native answer too. `mtimeMs` is the same arithmetic
 * `runtime-host.c` does, so the two print the same digits, fraction and all.
 */
function statMtimeSync(path) {
  const st = fs.statSync(path, { throwIfNoEntry: false });
  if (st === undefined) {
    return Number.NaN;
  }
  return st.mtimeMs;
}

/**
 * The RT-9 owner checks (#386): `lstatOwnerModeSync(path)` is the owner's uid
 * in the high 32 bits and `st_mode` in the low 32 of one `lstat`, so a
 * symbolic link answers for itself, or -1 when the path does not resolve or
 * holds a NUL; `geteuid()` is the effective uid; `isExecutableSync(path)` is
 * `access(path, X_OK)`. Each answers what `runtime-host.c` answers, the two
 * `i64`s as BigInts because that is how an `i64` is held on this side. Node's
 * `fs` throws on a NUL in a path where the runtime names nothing, so the
 * `catch` is what makes the two agree there too.
 */
function lstatOwnerModeSync(path) {
  try {
    const st = fs.lstatSync(path);
    return BigInt.asIntN(64, (BigInt(st.uid >>> 0) << 32n) | BigInt(st.mode >>> 0));
  } catch {
    return -1n;
  }
}

function geteuid() {
  return BigInt(process.geteuid());
}

function isExecutableSync(path) {
  try {
    fs.accessSync(path, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** The host-bound builtins by name, for the host's `call`. */
const CALLS = {
  readFileSync,
  readFileSyncOrNull,
  readFileBytesSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  isDirectorySync,
  readdirSync,
  realpathSync,
  platform,
  arch,
  getenv,
  spawnSync,
  spawnSyncTo,
  kill,
  availableParallelism,
  totalMemory,
  monotonicNanos,
  statMtimeSync,
  lstatOwnerModeSync,
  geteuid,
  isExecutableSync,
};

installHost({
  writeOut: (s) => fs.writeSync(1, s),
  writeErr: (s) => fs.writeSync(2, s),
  exit: (code) => process.exit(code),
  argv: () => process.argv.slice(1),
  call: (name, args) => CALLS[name](...args),
});
