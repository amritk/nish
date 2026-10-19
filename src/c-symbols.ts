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
//       - every library function LLVM recognises by name
//         (`TargetLibraryInfo`, which `llvm-tli-checker --dump-tli` prints) on
//         x86_64 and aarch64 Linux and Darwin and on wasm32-wasi: LLVM treats
//         a function of that name and type as the C one whatever its linkage,
//         so a private `abs` returning `x + 1000` was folded, and called, as
//         the C `abs`;
//       - every name a wasi-libc member defines or references when
//         `--profile wasi` links wasi-libc statically, reserved on every target
//         like the rest: one member's reference to another binds to a program
//         function of the same name (an exported `sbrk` trapped at start,
//         `strdup` broke `writeFileSync`), and a definition beside a member's is a duplicate
//         symbol (`fwrite`, `rename`, `unlink`). The members are the ones a
//         link of the whole runtime with `tests/c-symbols/math.ts` and
//         `lowered.ts` pulls in, read from the wasi-libc `tests/run.js` finds
//         installed; another wasi-libc or wasi-sdk release can pull in other
//         members, and the check then names what they add.
//
// `tests/run.js` holds the list to the toolchain ("c-symbols: ..."): every
// symbol `llvm-nm -u` finds in the runtime's objects, in `runtime-wasm.c`, in
// the N-API shim, and in two programs -- `tests/c-symbols/math.ts`, which calls
// every `Math` builtin and `%` on a float, and `lowered.ts`, which multiplies
// and divides `i64`s, copies and fills arrays and builds and prints strings --
// each linked at `-O0`, `-Oz` and `-O3` with LTO (its LTO object and its
// executable both) and compiled for wasm32-wasi, every global the wasi-libc
// members a traced `--profile wasi` link of each program pulls in define or
// reference, and every name `llvm-tli-checker` reports available on the five
// triples above, is reserved here, or the suite fails. The exceptions are the
// runtime's own `nish_` names (NL2202 reserves them) and `main`.
//
// The names are reserved on every target, not only where each one binds: a
// name only wasi-libc defines (`strdup`, `unlink`) is refused in a native build
// too, so that a program compiles to the same thing for every target it runs
// on. There is no flag that lifts the rule.
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
  name === "abs" ||
  name === "accept" ||
  name === "accept4" ||
  name === "access" ||
  name === "acos" ||
  name === "acosf" ||
  name === "acosh" ||
  name === "acoshf" ||
  name === "acoshl" ||
  name === "acosl" ||
  name === "aligned_alloc" ||
  name === "asin" ||
  name === "asinf" ||
  name === "asinh" ||
  name === "asinhf" ||
  name === "asinhl" ||
  name === "asinl" ||
  name === "atan" ||
  name === "atan2" ||
  name === "atan2f" ||
  name === "atan2l" ||
  name === "atanf" ||
  name === "atanh" ||
  name === "atanhf" ||
  name === "atanhl" ||
  name === "atanl" ||
  name === "atof" ||
  name === "atoi" ||
  name === "atol" ||
  name === "atoll" ||
  name === "bcmp" ||
  name === "bcopy" ||
  name === "bind" ||
  name === "bzero" ||
  name === "cabs" ||
  name === "cabsf" ||
  name === "cabsl" ||
  name === "calloc" ||
  name === "cbrt" ||
  name === "cbrtf" ||
  name === "cbrtl" ||
  name === "ceil" ||
  name === "ceilf" ||
  name === "ceill" ||
  name === "chmod" ||
  name === "chown" ||
  name === "clearenv" ||
  name === "clearerr" ||
  name === "clock_gettime" ||
  name === "close" ||
  name === "closedir" ||
  name === "connect" ||
  name === "copysign" ||
  name === "copysignf" ||
  name === "copysignl" ||
  name === "cos" ||
  name === "cosf" ||
  name === "cosh" ||
  name === "coshf" ||
  name === "coshl" ||
  name === "cosl" ||
  name === "ctermid" ||
  name === "dprintf" ||
  name === "environ" ||
  name === "epoll_create1" ||
  name === "epoll_ctl" ||
  name === "epoll_wait" ||
  name === "errno" ||
  name === "execl" ||
  name === "execle" ||
  name === "execlp" ||
  name === "execv" ||
  name === "execvP" ||
  name === "execve" ||
  name === "execvp" ||
  name === "execvpe" ||
  name === "exit" ||
  name === "exp" ||
  name === "exp10" ||
  name === "exp10f" ||
  name === "exp2" ||
  name === "exp2f" ||
  name === "exp2l" ||
  name === "expf" ||
  name === "expl" ||
  name === "expm1" ||
  name === "expm1f" ||
  name === "expm1l" ||
  name === "fabs" ||
  name === "fabsf" ||
  name === "fabsl" ||
  name === "faccessat" ||
  name === "fclose" ||
  name === "fcntl" ||
  name === "fdopen" ||
  name === "fdopendir" ||
  name === "feof" ||
  name === "ferror" ||
  name === "fflush" ||
  name === "ffs" ||
  name === "ffsl" ||
  name === "ffsll" ||
  name === "fgetc" ||
  name === "fgetc_unlocked" ||
  name === "fgetpos" ||
  name === "fgets" ||
  name === "fgets_unlocked" ||
  name === "fileno" ||
  name === "flockfile" ||
  name === "floor" ||
  name === "floorf" ||
  name === "floorl" ||
  name === "fmax" ||
  name === "fmaxf" ||
  name === "fmaxl" ||
  name === "fmin" ||
  name === "fminf" ||
  name === "fminl" ||
  name === "fmod" ||
  name === "fmodf" ||
  name === "fmodl" ||
  name === "fopen" ||
  name === "fopen64" ||
  name === "fork" ||
  name === "fprintf" ||
  name === "fputc" ||
  name === "fputc_unlocked" ||
  name === "fputs" ||
  name === "fputs_unlocked" ||
  name === "fread" ||
  name === "fread_unlocked" ||
  name === "free" ||
  name === "frexp" ||
  name === "frexpf" ||
  name === "frexpl" ||
  name === "fscanf" ||
  name === "fseek" ||
  name === "fseeko" ||
  name === "fseeko64" ||
  name === "fsetpos" ||
  name === "fstat" ||
  name === "fstat64" ||
  name === "fstatat" ||
  name === "fstatvfs" ||
  name === "fstatvfs64" ||
  name === "ftell" ||
  name === "ftello" ||
  name === "ftello64" ||
  name === "ftrylockfile" ||
  name === "funlockfile" ||
  name === "fwrite" ||
  name === "fwrite_unlocked" ||
  name === "getc" ||
  name === "getc_unlocked" ||
  name === "getchar" ||
  name === "getchar_unlocked" ||
  name === "getentropy" ||
  name === "getenv" ||
  name === "geteuid" ||
  name === "getitimer" ||
  name === "getlogin_r" ||
  name === "getpid" ||
  name === "getpwnam" ||
  name === "getrandom" ||
  name === "gets" ||
  name === "getsockname" ||
  name === "getsockopt" ||
  name === "gettimeofday" ||
  name === "htonl" ||
  name === "htons" ||
  name === "inet_pton" ||
  name === "isascii" ||
  name === "isdigit" ||
  name === "kevent" ||
  name === "kqueue" ||
  name === "labs" ||
  name === "lchown" ||
  name === "ldexp" ||
  name === "ldexpf" ||
  name === "ldexpl" ||
  name === "link" ||
  name === "linkat" ||
  name === "listen" ||
  name === "llabs" ||
  name === "log" ||
  name === "log10" ||
  name === "log10f" ||
  name === "log10l" ||
  name === "log1p" ||
  name === "log1pf" ||
  name === "log1pl" ||
  name === "log2" ||
  name === "log2f" ||
  name === "log2l" ||
  name === "logb" ||
  name === "logbf" ||
  name === "logbl" ||
  name === "logf" ||
  name === "logl" ||
  name === "lseek" ||
  name === "lstat" ||
  name === "lstat64" ||
  name === "malloc" ||
  name === "malloc_trim" ||
  name === "malloc_usable_size" ||
  name === "mallopt" ||
  name === "memalign" ||
  name === "memccpy" ||
  name === "memchr" ||
  name === "memcmp" ||
  name === "memcpy" ||
  name === "memmove" ||
  name === "mempcpy" ||
  name === "memrchr" ||
  name === "memset" ||
  name === "mkdir" ||
  name === "mkdirat" ||
  name === "mktime" ||
  name === "modf" ||
  name === "modff" ||
  name === "modfl" ||
  name === "nearbyint" ||
  name === "nearbyintf" ||
  name === "nearbyintl" ||
  name === "ntohl" ||
  name === "ntohs" ||
  name === "open" ||
  name === "open64" ||
  name === "openat" ||
  name === "opendir" ||
  name === "opendirat" ||
  name === "pause" ||
  name === "pclose" ||
  name === "perror" ||
  name === "pipe" ||
  name === "pipe2" ||
  name === "popen" ||
  name === "posix_memalign" ||
  name === "posix_spawn_file_actions_addopen" ||
  name === "posix_spawn_file_actions_destroy" ||
  name === "posix_spawn_file_actions_init" ||
  name === "posix_spawnp" ||
  name === "pow" ||
  name === "powf" ||
  name === "powl" ||
  name === "pread" ||
  name === "printf" ||
  name === "program_invocation_name" ||
  name === "program_invocation_short_name" ||
  name === "pthread_atfork" ||
  name === "pthread_cond_broadcast" ||
  name === "pthread_cond_destroy" ||
  name === "pthread_cond_init" ||
  name === "pthread_cond_signal" ||
  name === "pthread_cond_timedwait" ||
  name === "pthread_cond_wait" ||
  name === "pthread_create" ||
  name === "pthread_detach" ||
  name === "pthread_join" ||
  name === "pthread_mutex_destroy" ||
  name === "pthread_mutex_init" ||
  name === "pthread_mutex_lock" ||
  name === "pthread_mutex_unlock" ||
  name === "putc" ||
  name === "putc_unlocked" ||
  name === "putchar" ||
  name === "putchar_unlocked" ||
  name === "puts" ||
  name === "pvalloc" ||
  name === "pwrite" ||
  name === "qsort" ||
  name === "qsort_r" ||
  name === "read" ||
  name === "readdir" ||
  name === "readlink" ||
  name === "readlinkat" ||
  name === "realloc" ||
  name === "reallocf" ||
  name === "realpath" ||
  name === "recv" ||
  name === "recvmsg" ||
  name === "remainder" ||
  name === "remainderf" ||
  name === "remainderl" ||
  name === "remove" ||
  name === "rename" ||
  name === "renameat" ||
  name === "rewind" ||
  name === "rint" ||
  name === "rintf" ||
  name === "rintl" ||
  name === "rmdir" ||
  name === "round" ||
  name === "roundeven" ||
  name === "roundevenf" ||
  name === "roundevenl" ||
  name === "roundf" ||
  name === "roundl" ||
  name === "sbrk" ||
  name === "scalbn" ||
  name === "scandir" ||
  name === "scandirat" ||
  name === "scanf" ||
  name === "sched_getaffinity" ||
  name === "sched_yield" ||
  name === "send" ||
  name === "sendmsg" ||
  name === "setbuf" ||
  name === "setitimer" ||
  name === "setsockopt" ||
  name === "setvbuf" ||
  name === "shutdown" ||
  name === "sigaction" ||
  name === "sigemptyset" ||
  name === "sin" ||
  name === "sincos" ||
  name === "sincosf" ||
  name === "sinf" ||
  name === "sinh" ||
  name === "sinhf" ||
  name === "sinhl" ||
  name === "sinl" ||
  name === "snprintf" ||
  name === "socket" ||
  name === "sprintf" ||
  name === "sqrt" ||
  name === "sqrtf" ||
  name === "sqrtl" ||
  name === "sscanf" ||
  name === "stat" ||
  name === "stat64" ||
  name === "statvfs" ||
  name === "statvfs64" ||
  name === "stderr" ||
  name === "stpcpy" ||
  name === "stpncpy" ||
  name === "strcasecmp" ||
  name === "strcat" ||
  name === "strchr" ||
  name === "strchrnul" ||
  name === "strcmp" ||
  name === "strcoll" ||
  name === "strcpy" ||
  name === "strcspn" ||
  name === "strdup" ||
  name === "strerror" ||
  name === "strerror_l" ||
  name === "strlcat" ||
  name === "strlcpy" ||
  name === "strlen" ||
  name === "strncasecmp" ||
  name === "strncat" ||
  name === "strncmp" ||
  name === "strncpy" ||
  name === "strndup" ||
  name === "strnlen" ||
  name === "strpbrk" ||
  name === "strrchr" ||
  name === "strspn" ||
  name === "strstr" ||
  name === "strtod" ||
  name === "strtof" ||
  name === "strtoimax" ||
  name === "strtok" ||
  name === "strtok_r" ||
  name === "strtol" ||
  name === "strtold" ||
  name === "strtoll" ||
  name === "strtoul" ||
  name === "strtoull" ||
  name === "strtoumax" ||
  name === "strxfrm" ||
  name === "symlink" ||
  name === "symlinkat" ||
  name === "sysconf" ||
  name === "system" ||
  name === "tan" ||
  name === "tanf" ||
  name === "tanh" ||
  name === "tanhf" ||
  name === "tanhl" ||
  name === "tanl" ||
  name === "time" ||
  name === "times" ||
  name === "tmpfile" ||
  name === "tmpfile64" ||
  name === "toascii" ||
  name === "trunc" ||
  name === "truncf" ||
  name === "truncl" ||
  name === "uname" ||
  name === "ungetc" ||
  name === "unlink" ||
  name === "unsetenv" ||
  name === "utime" ||
  name === "utimensat" ||
  name === "utimes" ||
  name === "valloc" ||
  name === "vdprintf" ||
  name === "vfprintf" ||
  name === "vfscanf" ||
  name === "vprintf" ||
  name === "vscanf" ||
  name === "vsnprintf" ||
  name === "vsprintf" ||
  name === "vsscanf" ||
  name === "waitpid" ||
  name === "wcrtomb" ||
  name === "wcslen" ||
  name === "wctomb" ||
  name === "write" ||
  name === "writev"
