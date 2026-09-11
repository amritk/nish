// A WASI preview1 host over an in-memory filesystem, in plain ES modules with
// no imports at all — the same file runs in a browser worker, in a Node worker
// and in `node web/compile.mjs`.
//
// `examples/wasi-host.mjs` already runs a wasi-profile module under Node's own
// `node:wasi`, and that is the right thing on a machine with files. A browser
// has neither `node:wasi` nor a filesystem, and the compiler is a program whose
// whole job is reading source files and writing `.ll` files, so the host it
// needs in a page is this one: the syscalls a wasi-libc build of `runtime/`
// actually makes, answered out of a `Map` the page owns.
//
// Only that subset is implemented. Everything else returns ENOSYS rather than
// pretending, because a compiler that silently read an empty file would be
// worse than one that stops. `imports()` still supplies every function a
// wasi-libc module may import, since a missing import fails instantiation.
//
// The filesystem is deliberately flat: paths are normalised strings, files are
// `Uint8Array`s, and directories are a set of names. Nothing here needs
// `fd_readdir`, so a tree would only buy a data structure to walk.

/** Thrown by `proc_exit`; `start()` turns it back into the program's status. */
export class ExitStatus extends Error {
  constructor(code) {
    super(`exited with status ${code}`);
    this.code = code;
  }
}

// The errno numbers this host answers with, from the preview1 table.
const ESUCCESS = 0;
const EBADF = 8;
const EEXIST = 20;
const EINVAL = 28;
const EISDIR = 31;
const ENOENT = 44;
const ENOSYS = 52;
const ENOTDIR = 54;

const FILETYPE_DIRECTORY = 3;
const FILETYPE_REGULAR = 4;
const FILETYPE_CHARACTER_DEVICE = 2;

const OFLAG_CREAT = 1 << 0;
const OFLAG_DIRECTORY = 1 << 1;
const OFLAG_EXCL = 1 << 2;
const OFLAG_TRUNC = 1 << 3;
const FDFLAG_APPEND = 1 << 0;

/** The preopened directory every relative path is resolved against. */
const PREOPEN_FD = 3;
const PREOPEN_NAME = ".";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * `a/./b`, `a/b/../c` and a leading `./` all name the same file to a program,
 * so they have to name the same key here. Absolute paths keep their leading
 * slash; a `..` that walks off the top is dropped, the way a chroot would.
 */
export const normalisePath = (path) => {
  const absolute = path.startsWith("/");
  const out = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === ".." && out.length > 0 && out[out.length - 1] !== "..") {
      out.pop();
      continue;
    }
    if (part === "..") continue;
    out.push(part);
  }
  return (absolute ? "/" : "") + out.join("/");
};

/** The directory part of a normalised path, or `""` for a name at the root. */
const parentOf = (path) => {
  const cut = path.lastIndexOf("/");
  return cut < 0 ? "" : path.slice(0, cut);
};

/**
 * The in-memory filesystem a compile runs against. `files` maps a normalised
 * path to its bytes; `directories` holds the paths that exist as directories,
 * with `""` (the preopen itself) always present.
 */
export class MemoryFileSystem {
  constructor(files = {}) {
    this.files = new Map();
    this.directories = new Set([""]);
    for (const [path, contents] of Object.entries(files)) {
      this.write(path, contents);
    }
  }

  /** Text in, bytes stored; every parent directory is created on the way. */
  write(path, contents) {
    const key = normalisePath(path);
    for (let dir = parentOf(key); dir !== ""; dir = parentOf(dir)) {
      this.directories.add(dir);
    }
    this.files.set(key, typeof contents === "string" ? encoder.encode(contents) : contents);
  }

  /** The bytes at `path`, or `null` when nothing is there. */
  read(path) {
    return this.files.get(normalisePath(path)) ?? null;
  }

  /** Every file, decoded as UTF-8 — what a worker posts back after a compile. */
  toText() {
    const out = {};
    for (const [path, bytes] of this.files) out[path] = decoder.decode(bytes);
    return out;
  }
}

/** One open file descriptor: where it points and how far the program has read. */
class OpenFile {
  constructor(path, { append = false, directory = false } = {}) {
    this.path = path;
    this.position = 0;
    this.append = append;
    this.directory = directory;
  }
}

/**
 * A WASI preview1 host bound to one module instance.
 *
 *   const host = new WasiHost({ args: ["nish", "main.ts"], fs });
 *   const { instance } = await WebAssembly.instantiate(module, host.imports());
 *   const status = host.start(instance);
 *
 * One host runs one instance once: the arena never shrinks and `proc_exit`
 * ends the instance, so a second compile gets a fresh instance rather than a
 * reset. That is the same trade `runtime/runtime_wasm.c` describes for the
 * freestanding profile, and instantiation of an already-compiled module is
 * cheap enough that a playground does not notice.
 */
export class WasiHost {
  constructor({ args = [], env = {}, fs = new MemoryFileSystem(), stdout, stderr } = {}) {
    this.args = args;
    this.env = env;
    this.fs = fs;
    this.instance = null;
    this.stdoutText = "";
    this.stderrText = "";
    this.onStdout =
      stdout ??
      ((text) => {
        this.stdoutText += text;
      });
    this.onStderr =
      stderr ??
      ((text) => {
        this.stderrText += text;
      });
    // One streaming decoder per stream: C stdio flushes wherever its buffer
    // filled, which can land in the middle of a multi-byte character.
    this.streamDecoders = [null, new TextDecoder(), new TextDecoder()];
    // 0, 1 and 2 are the standard streams; 3 is the preopened ".".
    this.fds = new Map([[PREOPEN_FD, new OpenFile("", { directory: true })]]);
    this.nextFd = 4;
  }

  /** The import object. `memory.buffer` is re-read on every use: it grows. */
  imports() {
    return { wasi_snapshot_preview1: this.#syscalls() };
  }

  /**
   * Run `_start` and answer the process status. A wasi command module exits by
   * trapping out of `proc_exit`, so the normal path through here is the catch.
   */
  start(instance) {
    this.instance = instance;
    try {
      instance.exports._start();
    } catch (error) {
      if (error instanceof ExitStatus) return error.code;
      throw error;
    }
    return 0;
  }

  get #view() {
    return new DataView(this.instance.exports.memory.buffer);
  }

  get #bytes() {
    return new Uint8Array(this.instance.exports.memory.buffer);
  }

  #string(pointer, length) {
    return decoder.decode(this.#bytes.subarray(pointer, pointer + length));
  }

  /** Resolve a path argument against the preopen `dirFd` points at. */
  #resolve(dirFd, pointer, length) {
    const base = this.fds.get(dirFd);
    if (!base || !base.directory) return null;
    const path = this.#string(pointer, length);
    return normalisePath(base.path === "" ? path : `${base.path}/${path}`);
  }

  /** The iovec array a read or write call describes, as memory subarrays. */
  #iovs(pointer, count) {
    const view = this.#view;
    const bytes = this.#bytes;
    const out = [];
    for (let i = 0; i < count; i++) {
      const buffer = view.getUint32(pointer + i * 8, true);
      const length = view.getUint32(pointer + i * 8 + 4, true);
      out.push(bytes.subarray(buffer, buffer + length));
    }
    return out;
  }

  #writeStream(fd, chunks) {
    let written = 0;
    for (const chunk of chunks) {
      // The subarray is a view on wasm memory, which `decode` may not keep.
      const text = this.streamDecoders[fd].decode(chunk.slice(), { stream: true });
      if (text !== "") {
        if (fd === 1) this.onStdout(text);
        else this.onStderr(text);
      }
      written += chunk.length;
    }
    return written;
  }

  #writeFile(open, chunks) {
    const existing = this.fs.files.get(open.path) ?? new Uint8Array(0);
    const at = open.append ? existing.length : open.position;
    let total = 0;
    for (const chunk of chunks) total += chunk.length;
    const end = at + total;
    const grown = end > existing.length ? new Uint8Array(end) : existing;
    if (grown !== existing) grown.set(existing);
    let cursor = at;
    for (const chunk of chunks) {
      grown.set(chunk, cursor);
      cursor += chunk.length;
    }
    this.fs.files.set(open.path, grown);
    open.position = end;
    return total;
  }

  #syscalls() {
    const unsupported = () => ENOSYS;
    return {
      args_sizes_get: (countPointer, sizePointer) => {
        const view = this.#view;
        view.setUint32(countPointer, this.args.length, true);
        view.setUint32(
          sizePointer,
          this.args.reduce((n, a) => n + encoder.encode(a).length + 1, 0),
          true
        );
        return ESUCCESS;
      },
      args_get: (pointersPointer, bufferPointer) =>
        this.#writeStrings(this.args, pointersPointer, bufferPointer),
      environ_sizes_get: (countPointer, sizePointer) => {
        const pairs = this.#environPairs();
        const view = this.#view;
        view.setUint32(countPointer, pairs.length, true);
        view.setUint32(
          sizePointer,
          pairs.reduce((n, p) => n + encoder.encode(p).length + 1, 0),
          true
        );
        return ESUCCESS;
      },
      environ_get: (pointersPointer, bufferPointer) =>
        this.#writeStrings(this.#environPairs(), pointersPointer, bufferPointer),

      fd_write: (fd, iovsPointer, iovsLength, writtenPointer) => {
        const chunks = this.#iovs(iovsPointer, iovsLength);
        let written;
        if (fd === 1 || fd === 2) {
          written = this.#writeStream(fd, chunks);
        } else {
          const open = this.fds.get(fd);
          if (!open) return EBADF;
          if (open.directory) return EISDIR;
          written = this.#writeFile(open, chunks);
        }
        this.#view.setUint32(writtenPointer, written, true);
        return ESUCCESS;
      },
      fd_read: (fd, iovsPointer, iovsLength, readPointer) => {
        const open = this.fds.get(fd);
        if (!open || open.directory) return fd === 0 ? this.#emptyRead(readPointer) : EBADF;
        const read = this.#readInto(open.path, open.position, this.#iovs(iovsPointer, iovsLength));
        open.position += read;
        this.#view.setUint32(readPointer, read, true);
        return ESUCCESS;
      },
      fd_pread: (fd, iovsPointer, iovsLength, offset, readPointer) => {
        const open = this.fds.get(fd);
        if (!open || open.directory) return fd === 0 ? this.#emptyRead(readPointer) : EBADF;
        const read = this.#readInto(open.path, Number(offset), this.#iovs(iovsPointer, iovsLength));
        this.#view.setUint32(readPointer, read, true);
        return ESUCCESS;
      },
      fd_seek: (fd, offset, whence, resultPointer) => {
        const open = this.fds.get(fd);
        if (!open) return EBADF;
        const size = (this.fs.files.get(open.path) ?? new Uint8Array(0)).length;
        // whence: 0 set, 1 cur, 2 end — the same order as `lseek`.
        const from = whence === 0 ? 0 : whence === 1 ? open.position : size;
        const next = from + Number(offset);
        if (next < 0) return EINVAL;
        open.position = next;
        this.#view.setBigUint64(resultPointer, BigInt(next), true);
        return ESUCCESS;
      },
      fd_close: (fd) => (this.fds.delete(fd) ? ESUCCESS : EBADF),
      fd_fdstat_get: (fd, resultPointer) => {
        const view = this.#view;
        const open = this.fds.get(fd);
        const filetype =
          fd <= 2 ? FILETYPE_CHARACTER_DEVICE : open?.directory ? FILETYPE_DIRECTORY : FILETYPE_REGULAR;
        if (fd > 2 && !open) return EBADF;
        view.setUint8(resultPointer, filetype);
        view.setUint16(resultPointer + 2, open?.append ? FDFLAG_APPEND : 0, true);
        // Claim every right: the page owns the filesystem, so there is nothing
        // to sandbox against here, and wasi-libc refuses calls it thinks a
        // descriptor lacks the right for.
        view.setBigUint64(resultPointer + 8, ~0n, true);
        view.setBigUint64(resultPointer + 16, ~0n, true);
        return ESUCCESS;
      },
      fd_filestat_get: (fd, resultPointer) => {
        const open = this.fds.get(fd);
        if (!open) return EBADF;
        return this.#filestat(open.path, open.directory, resultPointer);
      },
      fd_prestat_get: (fd, resultPointer) => {
        if (fd !== PREOPEN_FD) return EBADF;
        const view = this.#view;
        view.setUint8(resultPointer, 0); // preopentype: dir
        view.setUint32(resultPointer + 4, encoder.encode(PREOPEN_NAME).length, true);
        return ESUCCESS;
      },
      fd_prestat_dir_name: (fd, pointer, length) => {
        if (fd !== PREOPEN_FD) return EBADF;
        const name = encoder.encode(PREOPEN_NAME);
        if (length < name.length) return EINVAL;
        this.#bytes.set(name, pointer);
        return ESUCCESS;
      },

      path_open: (
        dirFd,
        _dirFlags,
        pathPointer,
        pathLength,
        openFlags,
        _rightsBase,
        _rightsInheriting,
        fdFlags,
        resultPointer
      ) => {
        const path = this.#resolve(dirFd, pathPointer, pathLength);
        if (path === null) return EBADF;
        const isDirectory = this.fs.directories.has(path);
        const exists = this.fs.files.has(path);
        if (openFlags & OFLAG_DIRECTORY && !isDirectory) return ENOTDIR;
        if (isDirectory && !(openFlags & OFLAG_CREAT)) {
          return this.#open(new OpenFile(path, { directory: true }), resultPointer);
        }
        if (exists && openFlags & OFLAG_EXCL) return EEXIST;
        if (!exists) {
          if (!(openFlags & OFLAG_CREAT)) return ENOENT;
          if (!this.fs.directories.has(parentOf(path))) return ENOENT;
          this.fs.files.set(path, new Uint8Array(0));
        } else if (openFlags & OFLAG_TRUNC) {
          this.fs.files.set(path, new Uint8Array(0));
        }
        return this.#open(new OpenFile(path, { append: Boolean(fdFlags & FDFLAG_APPEND) }), resultPointer);
      },
      path_filestat_get: (dirFd, _flags, pathPointer, pathLength, resultPointer) => {
        const path = this.#resolve(dirFd, pathPointer, pathLength);
        if (path === null) return EBADF;
        const directory = this.fs.directories.has(path);
        if (!directory && !this.fs.files.has(path)) return ENOENT;
        return this.#filestat(path, directory, resultPointer);
      },
      path_create_directory: (dirFd, pathPointer, pathLength) => {
        const path = this.#resolve(dirFd, pathPointer, pathLength);
        if (path === null) return EBADF;
        if (this.fs.files.has(path)) return EEXIST;
        if (this.fs.directories.has(path)) return EEXIST;
        if (!this.fs.directories.has(parentOf(path))) return ENOENT;
        this.fs.directories.add(path);
        return ESUCCESS;
      },
      path_remove_directory: unsupported,
      path_unlink_file: unsupported,
      path_rename: unsupported,
      path_readlink: unsupported,
      path_link: unsupported,
      path_symlink: unsupported,
      fd_readdir: unsupported,
      fd_fdstat_set_flags: () => ESUCCESS,
      fd_sync: () => ESUCCESS,
      fd_datasync: () => ESUCCESS,
      fd_tell: (fd, resultPointer) => {
        const open = this.fds.get(fd);
        if (!open) return EBADF;
        this.#view.setBigUint64(resultPointer, BigInt(open.position), true);
        return ESUCCESS;
      },
      poll_oneoff: unsupported,
      sched_yield: () => ESUCCESS,
      clock_time_get: (_id, _precision, resultPointer) => {
        this.#view.setBigUint64(resultPointer, BigInt(Math.round(Date.now() * 1e6)), true);
        return ESUCCESS;
      },
      clock_res_get: (_id, resultPointer) => {
        this.#view.setBigUint64(resultPointer, 1000n, true);
        return ESUCCESS;
      },
      random_get: (pointer, length) => {
        const bytes = this.#bytes.subarray(pointer, pointer + length);
        if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
        else for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0;
        return ESUCCESS;
      },
      proc_exit: (code) => {
        throw new ExitStatus(code);
      },
    };
  }

  #environPairs() {
    return Object.entries(this.env).map(([name, value]) => `${name}=${value}`);
  }

  /** The `args_get` / `environ_get` shape: a pointer array plus a NUL-joined blob. */
  #writeStrings(values, pointersPointer, bufferPointer) {
    const view = this.#view;
    const bytes = this.#bytes;
    let cursor = bufferPointer;
    values.forEach((value, index) => {
      view.setUint32(pointersPointer + index * 4, cursor, true);
      const encoded = encoder.encode(value);
      bytes.set(encoded, cursor);
      bytes[cursor + encoded.length] = 0;
      cursor += encoded.length + 1;
    });
    return ESUCCESS;
  }

  #open(open, resultPointer) {
    const fd = this.nextFd++;
    this.fds.set(fd, open);
    this.#view.setUint32(resultPointer, fd, true);
    return ESUCCESS;
  }

  #emptyRead(readPointer) {
    this.#view.setUint32(readPointer, 0, true);
    return ESUCCESS;
  }

  #readInto(path, offset, chunks) {
    const data = this.fs.files.get(path) ?? new Uint8Array(0);
    let read = 0;
    let cursor = offset;
    for (const chunk of chunks) {
      const slice = data.subarray(cursor, cursor + chunk.length);
      chunk.set(slice);
      read += slice.length;
      cursor += slice.length;
      if (slice.length < chunk.length) break;
    }
    return read;
  }

  /** filestat is 64 bytes; only filetype and size are ever read here. */
  #filestat(path, directory, resultPointer) {
    const view = this.#view;
    const size = directory ? 0 : (this.fs.files.get(path) ?? new Uint8Array(0)).length;
    for (let offset = 0; offset < 64; offset += 8) view.setBigUint64(resultPointer + offset, 0n, true);
    view.setUint8(resultPointer + 16, directory ? FILETYPE_DIRECTORY : FILETYPE_REGULAR);
    view.setBigUint64(resultPointer + 24, 1n, true); // nlink
    view.setBigUint64(resultPointer + 32, BigInt(size), true);
    return ESUCCESS;
  }
}
