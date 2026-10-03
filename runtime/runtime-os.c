/* Nish runtime, the operating system half: files, directories, subprocesses,
 * the environment, the clock, and which machine this is.
 *
 * Split out of runtime.c so that the two halves can be measured apart. Every
 * function here wraps a system call, which is the reason it has to be C at all:
 * the language cannot express `openat` or `posix_spawnp`, so the surface a
 * program uses to reach the operating system grows in this file and nowhere
 * else. runtime.c holds what every program touches whatever it does — the
 * arena, strings, arrays, number formatting, the panics — and that is a closed
 * set. Before the split the two shared one `.text*` budget, so a new syscall
 * wrapper raised the ceiling over the arena and the string functions as well,
 * and the number a reader saw for "the runtime" moved for a reason that had
 * nothing to do with it. Each file now carries its own measured ceiling in
 * tests/run.js; docs/wp7-runtime.md §"Runtime additions and budget" has both
 * rows and the reasoning.
 *
 * What a linked binary pays is unchanged: `-ffunction-sections
 * -Wl,--gc-sections` drops every function no program calls, whichever
 * translation unit defined it, and the symbol names are the same frozen ABI
 * they were.
 *
 * The declarations come from nish.h, the public ABI header, rather than from a
 * private copy: this file calls three of the core's symbols (`nish_alloc_struct`,
 * `nish_str_new`, `nish_array_grow`) and shares two of its layouts, and
 * compiling against the header a C host sees is what keeps a definition here
 * from drifting from the contract it is published under.
 */
#define _POSIX_C_SOURCE 200809L
/* `realpath` is XSI rather than POSIX base, so _POSIX_C_SOURCE alone does not
   declare it (measured on glibc 2.39: undeclared, and clang then infers
   `int`, which is a pointer-truncating bug rather than a compile error before
   C99). Declaring it here by hand would be worse than this line on Darwin,
   where <stdlib.h> gives `realpath` an asm label -- a hand declaration binds
   the LEGACY symbol, for which a NULL second argument is undefined. */
#define _XOPEN_SOURCE 700
#include <dirent.h>
#include <errno.h>
#include <limits.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#ifndef __wasi__
/* WASI has no processes, so `spawn.h` and `wait.h` do not exist there. */
#include <spawn.h>
#include <sys/wait.h>
extern char **environ;
#endif

#include "nish.h"

/* Darwin's <fcntl.h> declares `O_NOFOLLOW` only at its full C level, and the
   strict level the two macros above select is the one that binds the right
   `realpath`, so the flag is spelled here with Darwin's own value
   (<sys/fcntl.h>: 0x00000100). Linux and WASI declare it at POSIX 2008. */
#if defined(__APPLE__) && !defined(O_NOFOLLOW)
#define O_NOFOLLOW 0x00000100
#endif
/* `O_CLOEXEC` is POSIX 2008 and declared at that level everywhere; the
   fallback is for an older Darwin SDK, with its value from the same header. */
#if defined(__APPLE__) && !defined(O_CLOEXEC)
#define O_CLOEXEC 0x01000000
#endif

/* The same spelling runtime.c uses for its own cold paths: a function that
   reports and exits is never on a path worth optimising for. */
#define NISH_COLD __attribute__((noreturn, cold, noinline))

/* ---- Process and files */
void nish_exit(int32_t code) { exit(code); }
static NISH_COLD void nish_io_fail(const char *what, const nish_str *path) {
  dprintf(2, "nish: cannot %s%.*s\n", what, (int)path->len, path->data);
  _exit(1);
}

/* The longest string or array a read hands back: 2^31 - 1, the same limit
   runtime.c's `NISH_ARRAY_MAX` puts on a push. Under --number-mode i32
   `length` is an `i32`, so one byte more reads back negative and bounds-check
   elimination trusts it (docs/security/runtime.md, RT-1). */
#define NISH_LENGTH_MAX 2147483647

/* `readFileSyncOrNull(path)`: null rather than a message, so a program can
   turn a missing file into its own diagnostic and carry on.
 *
 * The `S_ISDIR` guard is what makes "or null" true of a **directory**, which
 * `open(O_RDONLY)` accepts: `lseek` then answers `LONG_MAX` on Linux and the
 * arena is asked for that many bytes, so the program dies with `out of memory`
 * instead of answering null. Node's `readFileSync` raises `EISDIR` and the
 * stage0 twin (the TypeScript compiler, deleted in R6) turned that into null,
 * so without this the two compilers answered differently for one tree — a
 * package whose `exports` names a directory, which WP21 S2 made reachable
 * (`tests/link/package_dir_target`).
 *
 * The test is `!S_ISDIR` rather than `S_ISREG` on purpose: a directory is the
 * only thing whose `lseek(SEEK_END)` answers `LONG_MAX`, and refusing anything
 * else would answer null where Node answers bytes. `/dev/null` is the case to
 * keep in mind — `readFileSync` there is `""` in Node and in `shim.mjs`, and a
 * narrower guard would have made it `null` here and split the two compilers
 * again for the entry a command line can name. `fstat` on the descriptor
 * rather than `stat` on the path, so the answer is about the file that was
 * opened and not about whatever the name means a moment later.
 *
 * The descriptor is `O_CLOEXEC` (docs/security/runtime.md, RT-12): a child
 * that a `scope()` task spawns while another task reads would otherwise
 * inherit it. A `pread` that a signal interrupts before it moves a byte is
 * retried rather than taken for the end of the file (RT-13). A local disk
 * never interrupts one, but FUSE and NFS can, and stopping there would hand
 * back the bytes so far as the whole file. */
nish_str *nish_read_file_or_null(const nish_str *path) {
  int fd = open(nish_cpath(path), O_RDONLY | O_CLOEXEC);
  if (fd < 0) return 0;
  struct stat st;
  off_t len = fstat(fd, &st) == 0 && !S_ISDIR(st.st_mode) ? lseek(fd, 0, SEEK_END) : -1;
  /* A file longer than a length can say is refused before anything is
     allocated, as an unreadable one is: null here, null from
     `readFileBytesSync`, and `cannot read` from `readFileSync`. The bytes read
     below are never more than `len`, so a file that grows meanwhile cannot
     pass the limit either. */
  if (len < 0 || len > NISH_LENGTH_MAX) {
    close(fd);
    return 0;
  }
  nish_str *s = nish_alloc_struct(8 + len + 1);
  uint64_t got = 0;
  ssize_t n;
  while ((n = pread(fd, s->data + got, len - got, got)) != 0) {
    if (n > 0) {
      got += n;
    } else if (errno != EINTR) {
      break;
    }
  }
  close(fd);
  s->len = got;
  s->data[got] = 0;
  return s;
}

/* `readFileBytesSync(path)` (WP34 N2): the same read, handed to the language as
   a `u8[]`. The bytes are not copied a second time: `nish_read_file_or_null`
   has already put them in the arena behind their 8-byte length, 8-aligned, so
   the header points `data` there with `len == cap`, and the NUL written after
   them is simply never indexed. Nothing on the way assumes UTF-8, so a zero
   byte and a byte of 0x80 or above come back as they are on disk. A `push`
   onto the result grows it into a fresh block, as it would any full array. */
nish_array *nish_read_file_bytes(const nish_str *path) {
  nish_str *s = nish_read_file_or_null(path);
  if (!s) return 0;
  nish_array *a = nish_alloc_struct(sizeof *a);
  *a = (nish_array){ s->len, s->len, s->data };
  return a;
}

nish_str *nish_read_file(const nish_str *path) {
  nish_str *s = nish_read_file_or_null(path);
  if (!s) nish_io_fail("read ", path);
  return s;
}

/* `O_NOFOLLOW` (docs/security/runtime.md, RT-4): a symbolic link as the last
   component of the path is refused, as an unwritable file is, rather than
   followed to whatever file it names. `nish file.ts` writes `file.ll` beside
   its source, so a link planted at that name in a checkout would otherwise
   truncate any file the user can write. A link among the directories on the
   way is still followed.

   `O_CLOEXEC` for the reason the read has it (RT-12), and `EINTR` is retried
   as the read retries it (RT-13): a write cut short is finished, and one that
   fails is `cannot write`, never a silently short file. */
static void nish_put_file(const nish_str *path, const nish_str *data, int flags) {
  int fd = open(nish_cpath(path), O_WRONLY | O_CREAT | O_NOFOLLOW | O_CLOEXEC | flags, 0644);
  if (fd < 0) nish_io_fail("write ", path);
  for (uint64_t done = 0; done < data->len;) {
    ssize_t n = write(fd, data->data + done, data->len - done);
    if (n > 0) {
      done += n;
    } else if (n == 0 || errno != EINTR) {
      nish_io_fail("write ", path);
    }
  }
  close(fd);
}
void nish_write_file(const nish_str *path, const nish_str *data) { nish_put_file(path, data, O_TRUNC); }
void nish_append_file(const nish_str *path, const nish_str *data) { nish_put_file(path, data, O_APPEND); }

/* ---- Directories and subprocesses (WP14 D4): what a driver needs to create
   its own output directory and shell out for `--link`. Both answer a value
   instead of exiting, as `nish_read_file_or_null` does — there are no
   exceptions, so the caller owns the diagnostic — and so does the `stat`
   beside them (WP14 §7a), which is what tells `-o <dir>` from `-o <file>`.
   Contracts: nish.h. */

/* `isDirectorySync(path)` (WP14 §7a): the one question a driver asks of a path
   it was handed — is there a directory here? A missing path, a plain file and
   a parent it cannot search are the same false, because they are the same
   answer to that question. */
_Bool nish_is_dir(const nish_str *path) {
  struct stat st;
  return stat(nish_cpath(path), &st) == 0 && S_ISDIR(st.st_mode);
}

/* One directory, not recursive. The retry is the `stat` above rather than
   `errno == EEXIST` so that a plain file at the path answers false, which is
   what the promise "a directory is there afterwards" means. */
_Bool nish_mkdir(const nish_str *path) {
  return mkdir(nish_cpath(path), 0777) == 0 || nish_is_dir(path);
}

/* `posix_spawnp` is one libc call where fork/execvp/waitpid would be three,
   it searches PATH, and glibc reports a failed exec through its return
   value rather than through a child that has already run.

   `out` and `err` are paths for the child's stdout and stderr, or NULL to let
   it inherit this process's. Both spawn builtins are this function with those
   two arguments answered differently, so the argv vector, the wait and the
   signal convention are written once; it is `static`, so a program that spawns
   nothing still loses all three to `--gc-sections`. */
static int32_t nish_spawn_impl(const nish_array *argv, const nish_str *out, const nish_str *err) {
#ifdef __wasi__
  (void)argv;
  (void)out;
  (void)err;
  return -1;
#else
  if (!argv->len) return -1; /* argv[0] would read past an empty array */
  nish_str **s = (nish_str **)argv->data;
  /* NULL-terminated, borrowing each string's bytes; the arena owns it, so no
     path out of here has anything to free. */
  char **v = nish_alloc_struct((argv->len + 1) * sizeof *v);
  uint64_t i = 0;
  /* An argument holding a NUL is refused rather than cut short at it, which
     would run a different command line from the one the program built: it is
     the one whose C string is not its own bytes. */
  for (; i < argv->len; i++) {
    v[i] = (char *)nish_cpath(s[i]);
    if (v[i] != s[i]->data) return -1;
  }
  v[i] = 0;
  /* One list of file actions whether or not a stream is redirected: an empty
     list is the same spawn as none, and one path through is less code than
     creating the list only when a stream needs it. */
  posix_spawn_file_actions_t fa;
  if (posix_spawn_file_actions_init(&fa)) return -1;
  const nish_str *to[2] = { out, err };
  for (int k = 0; k < 2; k++) {
    /* The child opens the file, not this process: a redirect that this process
       performed would have to be undone afterwards, and a failed open would
       leave its own stdout pointing at the file. */
    if (to[k]) posix_spawn_file_actions_addopen(&fa, k + 1, nish_cpath(to[k]), O_WRONLY | O_CREAT | O_TRUNC | O_NOFOLLOW, 0644);
  }
  pid_t pid;
  int status;
  int failed = posix_spawnp(&pid, v[0], &fa, 0, v, environ);
  posix_spawn_file_actions_destroy(&fa);
  if (failed) return -1;
  if (waitpid(pid, &status, 0) < 0) return -1;
  return WIFSIGNALED(status) ? 128 + WTERMSIG(status) : WEXITSTATUS(status);
#endif
}

int32_t nish_spawn(const nish_array *argv) { return nish_spawn_impl(argv, 0, 0); }

/* `spawnSyncTo(argv, stdoutPath, stderrPath)`: the same run with a stream sent
   to a file, which is what comparing a program's output against a golden needs
   — `nish_spawn` answers a status and the output is gone. An **empty** path
   leaves that stream inherited, so one call can capture stdout and let stderr
   through to the terminal. Each file is created or truncated at 0644 and a
   symbolic link at its name is refused, as `writeFileSync` does; the child
   then fails to start, and the answer is -1.

   Two streams must not name one path: each would be opened separately, with
   its own offset, and the two would overwrite each other rather than
   interleave. Capturing them apart and concatenating is the way to merge. */
int32_t nish_spawn_to(const nish_array *argv, const nish_str *out, const nish_str *err) {
  return nish_spawn_impl(argv, out->len ? out : 0, err->len ? err : 0);
}

/* `readdirSync(path)`: the listing a driver needs to discover its own inputs.

   **Sorted by bytes**, which `readdir(3)` and Node are not, for two reasons
   that both belong to this language rather than to taste: there is no `sort`,
   so every caller of an unsorted listing would have to write one, and an order
   that is the file system's is an order that differs between two machines
   running the same suite. `.` and `..` are dropped, as Node drops them; every
   other dotfile is kept.

   NULL when the directory cannot be read — the language's `string[] | null` —
   so a missing directory is a diagnostic the caller writes and not an exit. An
   empty directory is an empty array, which is a different answer. */
nish_array *nish_readdir(const nish_str *path) {
#ifdef __wasi__
  /* The WASI form of this is a different contract, not a port of this one:
     `fd_readdir` lists a preopened directory rather than a path, and the wasi
     profile has no check in the default run. NULL until it has both. */
  (void)path;
  return 0;
#else
  DIR *d = opendir(nish_cpath(path));
  if (!d) return 0;
  nish_array *a = nish_alloc_struct(sizeof *a);
  *a = (nish_array){ 0, 0, 0 };
  const struct dirent *e;
  while ((e = readdir(d))) {
    const char *n = e->d_name;
    if (n[0] == '.' && (!n[1] || (n[1] == '.' && !n[2]))) continue;
    if (a->len == a->cap) nish_array_grow(a, sizeof(nish_str *));
    ((nish_str **)a->data)[a->len++] = nish_str_new(n, strlen(n));
  }
  closedir(d);
  /* Heapsort over pointers, in place. It was an insertion sort, on the theory
     that a directory is short, but whoever fills the directory decides that:
     100,000 names took 2.5 billion compares and 12.5 s, where this takes 3.0
     million and 0.07 s (docs/security/runtime.md, RT-5). It needs no scratch
     memory, and unlike `qsort` costs no comparator symbol or unwind entry. */
  nish_str **v = (nish_str **)a->data;
  /* Each pass sifts one name down the max-heap `v[0, end)`: first every
     parent from the middle up, which builds the heap, then the name the
     largest is swapped out for, which shrinks the heap by one. */
  uint64_t i = a->len / 2, end = a->len;
  while (end > 1) {
    nish_str *s;
    if (i) {
      s = v[--i];
    } else {
      s = v[--end];
      v[end] = v[0];
    }
    uint64_t j = i, c;
    while ((c = 2 * j + 1) < end) {
      if (c + 1 < end && strcmp(v[c]->data, v[c + 1]->data) < 0) c++;
      if (strcmp(s->data, v[c]->data) >= 0) break;
      v[j] = v[c];
      j = c;
    }
    v[j] = s;
  }
  return a;
#endif
}

/* `monotonicNanos()`: `CLOCK_MONOTONIC` in nanoseconds, which is what timing a
   run needs. Not the wall clock: a wall clock corrected mid-run can go
   backwards and make an elapsed time negative. Only the difference between two
   reads means anything — the origin is arbitrary and is not comparable across
   processes or machines — and an i64 of nanoseconds is 292 years of it. */
int64_t nish_monotonic_nanos(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (int64_t)ts.tv_sec * 1000000000 + ts.tv_nsec;
}

/* A C string copied into the arena, or NULL for NULL: the shape of every
   answer libc hands back by pointer, `getenv`'s here and `realpath`'s below. */
static nish_str *nish_str_or_null(const char *v) { return v ? nish_str_new(v, strlen(v)) : 0; }

/* ---- The environment (WP19 R1): `getenv(name)`, the one environment read the
   language has. A driver needs it to honour `CC` the way `scripts/build.sh`
   does before it spawns that script, which is the whole reason it exists.

   The bytes are copied into the arena rather than handed back where libc put
   them: `getenv` answers a pointer into `environ`, and a later `setenv` in the
   same process may move or overwrite that block, so a string the program is
   still holding would change under it. Copying makes it an ordinary arena
   string with the lifetime every other one has. NULL for an unset variable,
   which is the language's `string | null`. Contract: nish.h. */
nish_str *nish_getenv(const nish_str *name) {
  return nish_str_or_null(getenv(nish_cpath(name)));
}

/* ---- Symlinks (WP19 §5a item 4): `realpathSync(path)`, the one path
   resolution the language has. A compiler that finds `scripts/build.sh` and
   `std/` relative to its own `argv[0]` cannot do it through a symlink without
   this: `ln -s /opt/nish/bin/nish /usr/local/bin/nish` is the ordinary way a
   binary reaches `$PATH`, and npm links every command the same way, so the
   directory `argv[0]` names is the link's rather than the package's.

   A PATH_MAX buffer rather than `realpath(p, NULL)`, which is the shorter
   spelling and the wrong one here. Allocating the result is POSIX 2008, and
   on Darwin it is the `__DARWIN_EXTSN` variant that implements it -- the
   legacy symbol of the same name leaves a NULL second argument undefined. A
   caller-supplied buffer is defined for both, so it is the spelling that
   cannot depend on which variant a given feature-macro level binds.

   The result is copied into the arena, for the reason `nish_getenv` copies:
   what the arena owns has the lifetime every other string in the program has,
   and the stack buffer is gone at the return. NULL when the path does not
   resolve -- a path that does not exist included -- which is the language's
   `string | null` rather than an error, because the caller is asking whether
   it resolves. Contract: nish.h.

   A wasi-libc from before 2024, which is what Ubuntu and Debian package,
   neither declares nor defines `realpath`, so there every path is one that
   does not resolve and the answer is NULL. WebAssembly/wasi-libc#463 declared
   it and #473 defined it a month later, with no wasi-sdk release between, and
   #463 also gave `<dirent.h>` its `DT_SOCK`, which the old headers spell only
   for upstream musl. So a missing `DT_SOCK` is the test: it names the libc
   without the function, and wasi-sdk 22 and later keep the real `realpath`.
   It is a preprocessor test rather than a declaration of our own because the
   old libc.a has no definition to link. */
nish_str *nish_realpath(const nish_str *path) {
#if defined(__wasi__) && !defined(DT_SOCK)
  (void)path;
  return 0;
#else
  char buf[PATH_MAX];
  return nish_str_or_null(realpath(nish_cpath(path), buf));
#endif
}

/* ---- What machine this is (WP14 §7a): `process.platform` and `process.arch`,
   the two halves `--target host` composes a triple from. Both are settled when
   this file is compiled — a cross build compiles the runtime for the target,
   so the answer is the target's — which is why each is a string in constant
   data handed back by address: no allocation and no load, and `readnone` on
   the declaration (src/runtime.ts) is a fact rather than a hope. The
   spellings are Node's, so a program reads the same answer from this runtime
   and from `runtime/shim.mjs`; anything neither branch names is "unknown",
   which is what `--target host` then refuses. Contracts: nish.h.

   The static object is spelled with a sized array because a flexible array
   member cannot be initialised, and handed out as an `nish_str *`: the two
   layouts are the same bytes, and nothing anywhere writes through either
   pointer, so there is no aliasing question to answer. */
#define NISH_TEXT(name, s) \
  static const struct { uint64_t len; char data[sizeof s]; } name = { sizeof s - 1, s }

#if defined(__APPLE__)
NISH_TEXT(nish_platform_text, "darwin");
#elif defined(__linux__)
NISH_TEXT(nish_platform_text, "linux");
#else
NISH_TEXT(nish_platform_text, "unknown");
#endif

#if defined(__x86_64__)
NISH_TEXT(nish_arch_text, "x64");
#elif defined(__aarch64__)
NISH_TEXT(nish_arch_text, "arm64");
#else
NISH_TEXT(nish_arch_text, "unknown");
#endif

const nish_str *nish_platform(void) { return (const nish_str *)&nish_platform_text; }
const nish_str *nish_arch(void) { return (const nish_str *)&nish_arch_text; }
