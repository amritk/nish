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
#include <dirent.h>
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

/* The same spelling runtime.c uses for its own cold paths: a function that
   reports and exits is never on a path worth optimising for. */
#define NISH_COLD __attribute__((noreturn, cold, noinline))

/* ---- Process and files */
void nish_exit(int32_t code) { exit(code); }
static NISH_COLD void nish_io_fail(const char *what, const nish_str *path) {
  dprintf(2, "nish: cannot %s%.*s\n", what, (int)path->len, path->data);
  _exit(1);
}

/* `readFileSyncOrNull(path)`: null rather than a message, so a program can
   turn a missing file into its own diagnostic and carry on.
 *
 * The `S_ISDIR` guard is what makes "or null" true of a **directory**, which
 * `open(O_RDONLY)` accepts: `lseek` then answers `LONG_MAX` on Linux and the
 * arena is asked for that many bytes, so the program dies with `out of memory`
 * instead of answering null. Node's `readFileSync` raises `EISDIR` and the
 * stage0 twin turns that into null, so without this the two compilers answered
 * differently for one tree — a package whose `exports` names a directory, which
 * WP21 S2 made reachable (`tests/link/package_dir_target`).
 *
 * The test is `!S_ISDIR` rather than `S_ISREG` on purpose: a directory is the
 * only thing whose `lseek(SEEK_END)` answers `LONG_MAX`, and refusing anything
 * else would answer null where Node answers bytes. `/dev/null` is the case to
 * keep in mind — `readFileSync` there is `""` in Node and in `shim.mjs`, and a
 * narrower guard would have made it `null` here and split the two compilers
 * again for the entry a command line can name. `fstat` on the descriptor
 * rather than `stat` on the path, so the answer is about the file that was
 * opened and not about whatever the name means a moment later. */
nish_str *nish_read_file_or_null(const nish_str *path) {
  int fd = open(path->data, O_RDONLY);
  if (fd < 0) return 0;
  struct stat st;
  off_t len = fstat(fd, &st) == 0 && !S_ISDIR(st.st_mode) ? lseek(fd, 0, SEEK_END) : -1;
  if (len < 0) {
    close(fd);
    return 0;
  }
  nish_str *s = nish_alloc_struct(8 + len + 1);
  uint64_t got = 0;
  ssize_t n;
  while ((n = pread(fd, s->data + got, len - got, got)) > 0) got += n;
  close(fd);
  s->len = got;
  s->data[got] = 0;
  return s;
}

nish_str *nish_read_file(const nish_str *path) {
  nish_str *s = nish_read_file_or_null(path);
  if (!s) nish_io_fail("read ", path);
  return s;
}

static void nish_put_file(const nish_str *path, const nish_str *data, int flags) {
  int fd = open(path->data, O_WRONLY | O_CREAT | flags, 0644);
  if (fd < 0) nish_io_fail("write ", path);
  for (uint64_t done = 0; done < data->len;) {
    ssize_t n = write(fd, data->data + done, data->len - done);
    if (n <= 0) nish_io_fail("write ", path);
    done += n;
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
  return stat(path->data, &st) == 0 && S_ISDIR(st.st_mode);
}

/* One directory, not recursive. The retry is the `stat` above rather than
   `errno == EEXIST` so that a plain file at the path answers false, which is
   what the promise "a directory is there afterwards" means. */
_Bool nish_mkdir(const nish_str *path) {
  return mkdir(path->data, 0777) == 0 || nish_is_dir(path);
}

/* `posix_spawnp` is one libc call where fork/execvp/waitpid would be three,
   it searches PATH, and glibc reports a failed exec through its return
   value rather than through a child that has already run.

   `out` and `err` are paths for the child's stdout and stderr, or NULL to let
   it inherit this process's. Both spawn builtins are this function with those
   two arguments answered differently, so the argv vector, the wait and the
   signal convention are written once; it is `static`, so a program that spawns
   nothing still loses all three to `--gc-sections`. */
static int32_t nish_spawn_impl(const nish_array *argv, const char *out, const char *err) {
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
  for (; i < argv->len; i++) v[i] = s[i]->data;
  v[i] = 0;
  posix_spawn_file_actions_t fa;
  posix_spawn_file_actions_t *fap = 0;
  if (out || err) {
    if (posix_spawn_file_actions_init(&fa)) return -1;
    fap = &fa;
    /* The child opens the file, not this process: a redirect that this process
       performed would have to be undone afterwards, and a failed open would
       leave its own stdout pointing at the file. */
    if (out) posix_spawn_file_actions_addopen(fap, 1, out, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (err) posix_spawn_file_actions_addopen(fap, 2, err, O_WRONLY | O_CREAT | O_TRUNC, 0644);
  }
  pid_t pid;
  int status;
  int failed = posix_spawnp(&pid, v[0], fap, 0, v, environ);
  if (fap) posix_spawn_file_actions_destroy(fap);
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
   through to the terminal. Each file is created or truncated at 0644, as
   `writeFileSync` does.

   Two streams must not name one path: each would be opened separately, with
   its own offset, and the two would overwrite each other rather than
   interleave. Capturing them apart and concatenating is the way to merge. */
int32_t nish_spawn_to(const nish_array *argv, const nish_str *out, const nish_str *err) {
  return nish_spawn_impl(argv, out->len ? out->data : 0, err->len ? err->data : 0);
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
  DIR *d = opendir(path->data);
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
  /* Insertion sort over pointers: a directory is short, and `qsort` would cost
     a comparator symbol and its unwind entry for a call that is never hot. */
  nish_str **v = (nish_str **)a->data;
  for (uint64_t i = 1; i < a->len; i++) {
    nish_str *s = v[i];
    uint64_t j = i;
    while (j && strcmp(v[j - 1]->data, s->data) > 0) {
      v[j] = v[j - 1];
      j--;
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
  const char *v = getenv(name->data);
  if (!v) return 0;
  uint64_t len = strlen(v);
  nish_str *s = nish_alloc_struct(8 + len + 1);
  s->len = len;
  memcpy(s->data, v, len + 1);
  return s;
}

/* ---- What machine this is (WP14 §7a): `process.platform` and `process.arch`,
   the two halves `--target host` composes a triple from. Both are settled when
   this file is compiled — a cross build compiles the runtime for the target,
   so the answer is the target's — which is why each is a string in constant
   data handed back by address: no allocation and no load, and `readnone` on
   the declaration (src/codegen/runtime.ts) is a fact rather than a hope. The
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
