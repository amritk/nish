// The C symbols a function of the program's own package may not be named
// after, when its name is its symbol (#618).
//
// A function the program exports keeps its name as its LLVM symbol -- the
// program's own package carries no prefix, so `export const write` is `@write`
// -- and so does every function under `--no-strict-exports`. That symbol is a
// global definition in the linked executable, and a global definition of a name
// the C library also defines is the one every other object's undefined
// reference binds to: the runtime's own `write(2)` reached the program's
// `write` and `console.log` printed nothing, and an exported `read` crashed the
// first `nish/threads` join that started the pool (#610 is the same collision
// through a hidden function, which takes a `$` instead).
//
// The list is what the link can bind that way, in four parts:
//
//   - every symbol the runtime's objects leave undefined, apart from its own
//     `nish_` names (which NL2202 already reserves). `tests/run.js` holds the
//     list to `llvm-nm -u` of the runtime built natively, with and without
//     `--threads`, and for wasm32-wasi when a sysroot is installed ("c-symbols:
//     ..."), so a new call in the runtime that the list misses fails the suite;
//   - what the runtime calls only on Darwin and the BSDs, which no Linux run
//     can list: `accept`, `getentropy`, `kevent`, `kqueue`, `pipe`, and the
//     names Darwin gives `errno` and `stderr`;
//   - what LLVM lowers the emitter's intrinsics and its own idioms to: the
//     `memcpy` family, `bcmp`, and the libm calls `llvm.pow`, `llvm.floor`,
//     `llvm.round`, `llvm.roundeven`, `llvm.sqrt` and `frem` can become, with
//     the ones the optimiser rewrites them into (`exp2`, `ldexp`, `fmin`, ...);
//   - the rest of glibc's allocator, which a program replaces as a family: a
//     definition of one of them is a definition of the program's allocator.
//
// `main` is not here. The entry module's `main` is emitted as `@nish_main`
// behind the `@main` wrapper, and any other module's is refused already
// ("Only the entry module may declare `export function main`").

/** Whether a symbol of this name would replace one the C library defines for the runtime. */
export const isCLibrarySymbol = (name: string): boolean =>
  name === "_CLOCK_MONOTONIC" ||
  name === "_exit" ||
  name === "__cmsg_nxthdr" ||
  name === "__errno_location" ||
  name === "__error" ||
  name === "__isoc23_strtoll" ||
  name === "__lshrti3" ||
  name === "__multi3" ||
  name === "__sched_cpucount" ||
  name === "__stack_pointer" ||
  name === "__stderrp" ||
  name === "accept" ||
  name === "accept4" ||
  name === "access" ||
  name === "aligned_alloc" ||
  name === "bcmp" ||
  name === "bind" ||
  name === "calloc" ||
  name === "ceil" ||
  name === "clock_gettime" ||
  name === "close" ||
  name === "closedir" ||
  name === "connect" ||
  name === "dprintf" ||
  name === "environ" ||
  name === "epoll_create1" ||
  name === "epoll_ctl" ||
  name === "epoll_wait" ||
  name === "errno" ||
  name === "exit" ||
  name === "exp2" ||
  name === "fcntl" ||
  name === "floor" ||
  name === "fmax" ||
  name === "fmin" ||
  name === "fmod" ||
  name === "fputs" ||
  name === "free" ||
  name === "fstat" ||
  name === "getentropy" ||
  name === "getenv" ||
  name === "geteuid" ||
  name === "getpid" ||
  name === "getrandom" ||
  name === "getsockname" ||
  name === "getsockopt" ||
  name === "htons" ||
  name === "inet_pton" ||
  name === "kevent" ||
  name === "kqueue" ||
  name === "ldexp" ||
  name === "listen" ||
  name === "lseek" ||
  name === "lstat" ||
  name === "malloc" ||
  name === "malloc_usable_size" ||
  name === "memalign" ||
  name === "memchr" ||
  name === "memcmp" ||
  name === "memcpy" ||
  name === "memmove" ||
  name === "memset" ||
  name === "mkdir" ||
  name === "nearbyint" ||
  name === "ntohs" ||
  name === "open" ||
  name === "opendir" ||
  name === "pipe" ||
  name === "pipe2" ||
  name === "posix_memalign" ||
  name === "posix_spawn_file_actions_addopen" ||
  name === "posix_spawn_file_actions_destroy" ||
  name === "posix_spawn_file_actions_init" ||
  name === "posix_spawnp" ||
  name === "pow" ||
  name === "pread" ||
  name === "pthread_atfork" ||
  name === "pthread_cond_broadcast" ||
  name === "pthread_cond_destroy" ||
  name === "pthread_cond_init" ||
  name === "pthread_cond_signal" ||
  name === "pthread_cond_wait" ||
  name === "pthread_create" ||
  name === "pthread_detach" ||
  name === "pthread_join" ||
  name === "pthread_mutex_destroy" ||
  name === "pthread_mutex_init" ||
  name === "pthread_mutex_lock" ||
  name === "pthread_mutex_unlock" ||
  name === "pvalloc" ||
  name === "read" ||
  name === "readdir" ||
  name === "realloc" ||
  name === "realpath" ||
  name === "recv" ||
  name === "recvmsg" ||
  name === "rint" ||
  name === "round" ||
  name === "roundeven" ||
  name === "sched_getaffinity" ||
  name === "sched_yield" ||
  name === "send" ||
  name === "sendmsg" ||
  name === "setsockopt" ||
  name === "shutdown" ||
  name === "sigaction" ||
  name === "sigemptyset" ||
  name === "snprintf" ||
  name === "socket" ||
  name === "sqrt" ||
  name === "stat" ||
  name === "stderr" ||
  name === "strcmp" ||
  name === "strcpy" ||
  name === "strcspn" ||
  name === "strlen" ||
  name === "strncmp" ||
  name === "strspn" ||
  name === "strstr" ||
  name === "strtod" ||
  name === "strtoll" ||
  name === "sysconf" ||
  name === "time" ||
  name === "trunc" ||
  name === "valloc" ||
  name === "waitpid" ||
  name === "write"
