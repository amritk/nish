// The C symbols a function of the program's own package may not take as its
// own when its name is its symbol (#618), and the companion rule that gives a
// function whose symbol is not its ABI a spelling C cannot reach (#610).
//
// A module of the program's own package carries no symbol prefix, so a
// function's symbol is its name. An exported one -- `export const write` is
// `@write` -- and every function under `--no-strict-exports` is then a global
// definition in the linked program, and a global definition of a name the C
// library also defines is the one every other object's undefined reference
// binds to: the runtime's own `write(2)` reached the program's `write` and
// `console.log` printed nothing, a helper module's exported `write` crashed,
// and a `Math.sin` call reached an exported `sin`. Such a function is refused
// (NL3037, `rejectCLibrarySymbols` in `src/compilation.ts`): its name is its
// ABI -- a C host's, a wasm host's or Node's through N-API -- so it cannot be
// renamed. A function whose symbol is not its ABI -- an `internal` one, or a
// `hidden` one another module's instantiation calls -- takes a `$` at the end
// instead (`spellCSymbolsApart` in `src/generics.ts`): an internal function's
// name is still one LLVM recognises, and a private `floor` called as
// `floor(1.5)` was folded as the C library's `floor`.
//
// What is reserved, and where each part comes from:
//
//   - every name that begins with `_`, which C reserves for the implementation
//     at file scope (C11 7.1.3): the C start-up files and libc's own internals
//     (`__libc_start_main`, `__register_atfork`, `_start`, `__environ`,
//     `_IO_2_1_stdout_`, ...) cannot be listed one by one, and each of them
//     crashed or failed to link when a program defined it;
//   - every name that begins with `napi_` or `node_api_`, which Node-API
//     reserves for its own functions: the N-API shim `src/interop-napi.ts`
//     writes calls to the first, and its `NAPI_MODULE_INIT` defines one of the
//     second (`node_api_module_get_api_version_v1`);
//   - the names `isCLibrarySymbol` lists:
//       - every symbol the runtime's objects leave undefined, natively, with
//         `-DNISH_THREADS` and for wasm32-wasi, and every one
//         `runtime/runtime-wasm.c` defines or leaves undefined (it defines
//         `fmin`, `fminf`, `fmax` and `fmaxf` itself);
//       - what the runtime calls only on Darwin and the BSDs, which no Linux
//         run can list: `accept`, `getentropy`, `kevent`, `kqueue`, `pipe`;
//       - the C library calls a program's own code reaches through LLVM: the
//         libm functions behind every `Math` builtin and `%` on a float, in
//         `double` and in `float` (LLVM narrows a `double` call whose result
//         is truncated), the ones the optimiser rewrites them into (`sincos`,
//         `exp2`, `ldexp`, `cbrt`, ...), and the `memcpy` family and `bcmp`
//         it lowers copies and comparisons to;
//       - the rest of glibc's replaceable allocator, a family a program
//         replaces together;
//       - under `--profile wasi`, where wasi-libc is linked statically, every
//         name a wasi-libc member the link pulls in defines or references:
//         one member's reference to another binds to a program function of the
//         same name (an exported `sbrk` trapped at start, `strdup` broke
//         `writeFileSync`), and a definition beside a member's is a duplicate
//         symbol (`fwrite`, `rename`, `unlink`).
//
// `tests/run.js` holds the list to the toolchain ("c-symbols: ..."): every
// symbol `llvm-nm -u` finds in the runtime's objects, in `runtime-wasm.c`, in
// the N-API shim, and in two programs -- `tests/c-symbols/math.ts`, which calls
// every `Math` builtin and `%` on a float, and `lowered.ts`, which multiplies
// and divides `i64`s, copies and fills arrays and builds and prints strings --
// each linked at `-O0`, `-Oz` and `-O3` with LTO (its LTO object and its
// executable both) and compiled for wasm32-wasi, is reserved here, or the
// suite fails. The exceptions are the runtime's own
// `nish_` names (NL2202 reserves them) and `main`.
//
// `main` is not reserved. The entry module's `main` is emitted as `@nish_main`
// behind the `@main` wrapper, and any other module's is refused already
// ("Only the entry module may declare `export function main`").

/** Whether a symbol of this name is reserved to C: a listed name, or one of the reserved prefixes. */
export const isCReservedSymbol = (name: string): boolean =>
  name.startsWith("_") || name.startsWith("napi_") || name.startsWith("node_api_") || isCLibrarySymbol(name)

/** Whether a symbol of this name would replace one the C library defines for the runtime or the program. */
export const isCLibrarySymbol = (name: string): boolean =>
  name === "_CLOCK_MONOTONIC" ||
  name === "__cmsg_nxthdr" ||
  name === "__errno_location" ||
  name === "__error" ||
  name === "__heap_base" ||
  name === "__isoc23_strtoll" ||
  name === "__lshrti3" ||
  name === "__multi3" ||
  name === "__sched_cpucount" ||
  name === "__stack_pointer" ||
  name === "__stderrp" ||
  name === "__tls_get_addr" ||
  name === "_exit" ||
  name === "abort" ||
  name === "accept" ||
  name === "accept4" ||
  name === "access" ||
  name === "aligned_alloc" ||
  name === "bcmp" ||
  name === "bind" ||
  name === "calloc" ||
  name === "cbrt" ||
  name === "cbrtf" ||
  name === "ceil" ||
  name === "ceilf" ||
  name === "clearenv" ||
  name === "clock_gettime" ||
  name === "close" ||
  name === "closedir" ||
  name === "connect" ||
  name === "cos" ||
  name === "cosf" ||
  name === "dprintf" ||
  name === "environ" ||
  name === "epoll_create1" ||
  name === "epoll_ctl" ||
  name === "epoll_wait" ||
  name === "errno" ||
  name === "exit" ||
  name === "exp" ||
  name === "exp10" ||
  name === "exp10f" ||
  name === "exp2" ||
  name === "exp2f" ||
  name === "expf" ||
  name === "fabs" ||
  name === "fabsf" ||
  name === "faccessat" ||
  name === "fcntl" ||
  name === "fdopendir" ||
  name === "floor" ||
  name === "floorf" ||
  name === "fmax" ||
  name === "fmaxf" ||
  name === "fmin" ||
  name === "fminf" ||
  name === "fmod" ||
  name === "fmodf" ||
  name === "fputs" ||
  name === "fputs_unlocked" ||
  name === "free" ||
  name === "frexp" ||
  name === "fstat" ||
  name === "fstatat" ||
  name === "fwrite" ||
  name === "fwrite_unlocked" ||
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
  name === "ldexpf" ||
  name === "link" ||
  name === "linkat" ||
  name === "listen" ||
  name === "log" ||
  name === "log10" ||
  name === "log10f" ||
  name === "log2" ||
  name === "log2f" ||
  name === "logf" ||
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
  name === "mkdirat" ||
  name === "nearbyint" ||
  name === "nearbyintf" ||
  name === "ntohs" ||
  name === "open" ||
  name === "openat" ||
  name === "opendir" ||
  name === "opendirat" ||
  name === "pipe" ||
  name === "pipe2" ||
  name === "posix_memalign" ||
  name === "posix_spawn_file_actions_addopen" ||
  name === "posix_spawn_file_actions_destroy" ||
  name === "posix_spawn_file_actions_init" ||
  name === "posix_spawnp" ||
  name === "pow" ||
  name === "powf" ||
  name === "pread" ||
  name === "program_invocation_name" ||
  name === "program_invocation_short_name" ||
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
  name === "qsort" ||
  name === "qsort_r" ||
  name === "read" ||
  name === "readdir" ||
  name === "readlink" ||
  name === "readlinkat" ||
  name === "realloc" ||
  name === "realpath" ||
  name === "recv" ||
  name === "recvmsg" ||
  name === "remove" ||
  name === "rename" ||
  name === "renameat" ||
  name === "rint" ||
  name === "rintf" ||
  name === "rmdir" ||
  name === "round" ||
  name === "roundeven" ||
  name === "roundevenf" ||
  name === "roundf" ||
  name === "sbrk" ||
  name === "scalbn" ||
  name === "scandir" ||
  name === "scandirat" ||
  name === "sched_getaffinity" ||
  name === "sched_yield" ||
  name === "send" ||
  name === "sendmsg" ||
  name === "setsockopt" ||
  name === "shutdown" ||
  name === "sigaction" ||
  name === "sigemptyset" ||
  name === "sin" ||
  name === "sincos" ||
  name === "sincosf" ||
  name === "sinf" ||
  name === "snprintf" ||
  name === "socket" ||
  name === "sqrt" ||
  name === "sqrtf" ||
  name === "stat" ||
  name === "stderr" ||
  name === "stpcpy" ||
  name === "strchrnul" ||
  name === "strcmp" ||
  name === "strcpy" ||
  name === "strcspn" ||
  name === "strdup" ||
  name === "strerror" ||
  name === "strerror_l" ||
  name === "strlen" ||
  name === "strncmp" ||
  name === "strnlen" ||
  name === "strspn" ||
  name === "strstr" ||
  name === "strtod" ||
  name === "strtof" ||
  name === "strtoimax" ||
  name === "strtol" ||
  name === "strtold" ||
  name === "strtoll" ||
  name === "strtoul" ||
  name === "strtoull" ||
  name === "strtoumax" ||
  name === "symlink" ||
  name === "symlinkat" ||
  name === "sysconf" ||
  name === "tan" ||
  name === "tanf" ||
  name === "time" ||
  name === "trunc" ||
  name === "truncf" ||
  name === "unlink" ||
  name === "utime" ||
  name === "utimensat" ||
  name === "utimes" ||
  name === "valloc" ||
  name === "vdprintf" ||
  name === "vfprintf" ||
  name === "vsnprintf" ||
  name === "waitpid" ||
  name === "wcrtomb" ||
  name === "wctomb" ||
  name === "write" ||
  name === "writev"
