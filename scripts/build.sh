#!/usr/bin/env bash
# Build an Nish .ll module (plus optional C sources) into a native binary.
#
#   scripts/build.sh <module.ll> [more .ll/.c files...] -o <out> [--profile debug|speed|size|wasm|wasi|napi]
#
# The C runtime is ten translation units and is named as one: an input
# <dir>/runtime.c also compiles <dir>/runtime-os.c, the half that wraps the
# system calls (files, directories, subprocesses, the environment, the clock),
# <dir>/runtime-parallel.c, the half that divides a range of work across
# threads, <dir>/runtime-cross.c, the copies that carry a string or an array
# from one thread's arena to another's, <dir>/runtime-host.c, the wall clock, entropy, file times and
# signals, <dir>/runtime-net.c, the sockets of `nish:net`,
# <dir>/runtime-simd.c, the byte searches that read a vector at a time,
# <dir>/runtime-aes.c, AES-GCM on the CPU's AES instructions,
# <dir>/runtime-term.c, stdin and the terminal of `nish:term`, and
# <dir>/runtime-bytes.c, the byte-class runs of `nish/bytes`. Each of those
# files says why they are compiled and measured apart.
#
# Profiles:
#   debug  clang defaults: no optimisation, symbols kept. The "before" number.
#   speed  -O3 + LTO + section GC + strip. Rust `--release` equivalent.
#   size   -Oz + LTO + section GC + strip + no unwind tables. Rust
#          `opt-level="z"`, `panic="abort"`, `strip=true` equivalent.
#   wasm   wasm32 freestanding module exporting every non-internal function;
#          load it from Node. Add runtime/runtime-wasm.c to the inputs when a
#          function uses arrays (the arena and the array cold paths, no libc);
#          strings and I/O still need a WASI runtime and are not available.
#   wasi   wasm32-wasi command module: runtime.c linked against wasi-libc, so
#          string programs run under any WASI host (`_start` runs `main`;
#          `node examples/wasi-host.mjs app.wasm args...`). Needs a WASI
#          sysroot: WASI_SYSROOT=<dir>, or /usr/lib/wasi-sysroot,
#          /opt/wasi-sdk/share/wasi-sysroot, /usr/share/wasi-sysroot.
#   napi   Node addon (<out>.node): the speed flags plus -shared -fPIC, built
#          against the Node headers next to `node` (override: NODE_INCLUDE=<dir
#          containing node_api.h>). Inputs: <modules.ll> runtime/runtime.c and
#          the shim from `nish --emit-napi`.
#
# Profile-guided optimisation (WP9), for the speed, size and napi profiles:
#   --pgo-generate         instrumented build (-fprofile-generate); running the
#                          binary writes default_*.profraw into the current
#                          directory (or $LLVM_PROFILE_FILE)
#   --pgo-use <profdata>   optimise with a merged profile (-fprofile-use=<file>)
# Recipe:
#   scripts/build.sh app.ll runtime/runtime.c -o app.instr --profile speed --pgo-generate
#   ./app.instr <typical input>            # one or more training runs
#   llvm-profdata merge -o app.profdata default_*.profraw
#   scripts/build.sh app.ll runtime/runtime.c -o app --profile speed --pgo-use app.profdata
# The instrumented link needs the compiler-rt profile runtime (Ubuntu:
# libclang-rt-<ver>-dev; it ships with Apple clang and Homebrew llvm).
# docs/wp9-optimisation.md reports what PGO buys on the benchmark suite.
#
# Threads (WP20 T0): `--threads` compiles every input with -DNISH_THREADS, which
# makes the arena and the RNG seed in runtime/runtime.c thread-local. Pass it
# exactly when the IR was compiled with `nish --threads` (`nish --threads
# --link` does it for you): compiled modules reference `@nish_arena` as a
# thread-local global, and ELF will not link that against a non-TLS definition,
# so a half-threaded build fails at the link rather than at run time.
#
# Debug info (WP10): `-g` compiles every input with -g and skips the strip
# step of the speed/size/napi profiles, so the DWARF that `nish -g`
# put in the .ll (line table, variables) reaches the binary. `nish
# --link -g` passes it through automatically.
#
# CPU level (WP38 S2): `--cpu x86-64-v3` compiles and links every input --
# the module, the runtime and any other C -- with -march=x86-64-v3
# -ffp-contract=off, so the code generator may use AVX2, BMI2 and the other
# v3 instructions and still forms no fused multiply-add the IR did not write.
# It is the one level taken; any other value is refused with exit 2, and so are
# the wasm and wasi profiles, which are not x86-64. A binary built with it
# stops with SIGILL on a CPU without AVX2. `nish --link --cpu x86-64-v3`
# passes it through.
#
# SQLite: an input .ll that declares an `sqlite3_*` or `nishsqlite_*` function
# also compiles and links every runtime/sqlite/*.c, the vendored amalgamation
# (runtime/sqlite/README.md). Any other program compiles none of it. sqlite3.c
# is compiled to native code at the profile's level, even where the profile
# compiles to LTO bitcode. The options are most of SQLite's recommended set
# (see the defaults below), with THREADSAFE=0 (=2 under --threads).
# NISH_SQLITE_CFLAGS is appended to them: its first line, split on whitespace
# with no quoting, and a relative -I in it names a directory below
# runtime/sqlite/, where each unit is compiled. A -D or -U in it for one of
# their names replaces it. The napi profile compiles SQLite -fPIC and
# -fvisibility=hidden, so an addon does not export its symbols. Every profile
# but wasm links it; wasm has no libc to build it on and is refused with exit 2.
# On wasi, SQLite locks with dot files and has no WAL shared memory.
#
# The runtime compiled once (the debug, speed and size profiles only; `nish
# --link` and `nish run` use these through their runtime cache, src/compile.ts):
#   --runtime-objects <dir>  compile the runtime.c input and its seven siblings,
#                            one $CC -c each and all at once, into
#                            <dir>/<unit>.o with the profile's compile flags,
#                            and link nothing. speed and size store LTO bitcode,
#                            so the link can still inline the runtime into the
#                            program. No -o; prints nothing on success.
#   --runtime-from <dir>     link against <dir>/<unit>.o in place of a
#                            runtime.c input, after compiling every other input
#                            with its own $CC -c, all at once. The link line is
#                            the one the profile always uses.
#   --sqlite-objects <dir>   compile runtime/sqlite/*.c alone, into
#                            <dir>/<unit>.o, as a link of a program that calls
#                            SQLite would, and link nothing. Takes no inputs and
#                            no -o, and prints nothing on success.
#   --sqlite-from <dir>      link <dir>/<unit>.o in place of compiling
#                            runtime/sqlite/, when the IR calls SQLite.
# All four refuse the wasm, wasi and napi profiles and --pgo-*, with exit 2.
#
# Works on Linux (clang + lld preferred, GNU ld tolerated) and macOS (Apple ld64
# or Homebrew llvm). Set CC to pick a compiler (default: clang on PATH).
set -euo pipefail

profile=speed
out=""
inputs=()
pgo=()                                 # -fprofile-generate / -fprofile-use=<file>
debug=0                                # -g: keep DWARF (nish -g emits it in the IR; runtime.c gets it here)
threads=0                              # --threads: -DNISH_THREADS, the thread-local arena (WP20 T0)
objects_to=""                          # --runtime-objects <dir>: compile the runtime alone, into <dir>
objects_from=""                        # --runtime-from <dir>: link against the runtime compiled there
cpu=""                                 # --cpu x86-64-v3: the one CPU level above the baseline (WP38 S2)
sqlite_to=""                           # --sqlite-objects <dir>: compile runtime/sqlite/ alone, into <dir>
sqlite_from=""                         # --sqlite-from <dir>: link runtime/sqlite/ compiled there
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    --profile) profile="$2"; shift 2 ;;
    -g) debug=1; shift ;;
    --threads) threads=1; shift ;;
    --cpu)
      [ -n "${2-}" ] || { echo "error: --cpu needs a level; the one taken is x86-64-v3" >&2; exit 2; }
      cpu="$2"; shift 2 ;;
    --runtime-objects) objects_to="$2"; shift 2 ;;
    --runtime-from) objects_from="$2"; shift 2 ;;
    --sqlite-objects) sqlite_to="$2"; shift 2 ;;
    --sqlite-from) sqlite_from="$2"; shift 2 ;;
    --pgo-generate) pgo=(-fprofile-generate); shift ;;
    --pgo-use)
      [ -f "$2" ] || { echo "error: --pgo-use: profile '$2' not found (run the instrumented binary, then llvm-profdata merge)" >&2; exit 2; }
      pgo=("-fprofile-use=$2"); shift 2 ;;
    -h|--help) sed -n '2,/^set -euo pipefail$/{/^set -euo pipefail$/!p;}' "$0"; exit 0 ;;   # the header, to the first command
    *) inputs+=("$1"); shift ;;
  esac
done
[ ${#inputs[@]} -gt 0 ] || [ -n "$sqlite_to" ] || { echo "error: no input files" >&2; exit 2; }
if [ -n "$cpu" ]; then
  [ "$cpu" = x86-64-v3 ] || { echo "error: --cpu takes x86-64-v3, not '$cpu'" >&2; exit 2; }
  case "$profile" in
    wasm|wasi) echo "error: --cpu x86-64-v3 is an x86-64 level, so the $profile profile does not take it" >&2; exit 2 ;;
  esac
fi
# wasm-ld exports a wasm module's linear memory as `memory`, so under the wasm
# profile's `--export-all` a function of that name makes a module Node refuses
# to compile ("Duplicate export name 'memory'", #643). The wasi module exports
# only `memory` and `_start`, but the name is reserved there too, so a program
# that links for wasi also links for wasm. The compiler refuses one (NL3038)
# when it knows the build is wasm, but IR compiled for the host with `-o` alone
# reaches these profiles without telling it, so the IR is read here too.
case "$profile" in
  wasm|wasi)
    for i in ${inputs[@]+"${inputs[@]}"}; do
      case "$i" in
        *.ll)
          # An `internal` or `private` definition is not exported, so it is left alone.
          if grep -E '^define [^@]*@memory\(' "$i" | grep -Evq '^define (internal|private) '; then
            echo "error: $i defines a function named \`memory\`, the name the $profile profile's module exports its linear memory under; rename the function" >&2
            exit 2
          fi ;;
      esac
    done ;;
esac
if [ -n "$objects_to" ] || [ -n "$objects_from" ]; then
  # A cached runtime is the profile's ordinary compile, so it exists only for
  # the profiles that compile the runtime with nothing but these flags.
  case "$profile" in
    debug|speed|size) ;;
    *) echo "error: --runtime-objects and --runtime-from take the debug, speed and size profiles, not '$profile'" >&2; exit 2 ;;
  esac
  [ ${#pgo[@]} -eq 0 ] || { echo "error: --runtime-objects and --runtime-from do not take --pgo-*" >&2; exit 2; }
  [ -z "$objects_to" ] || [ -z "$objects_from" ] || { echo "error: --runtime-objects and --runtime-from are two different builds" >&2; exit 2; }
fi
if [ -n "$sqlite_to" ] || [ -n "$sqlite_from" ]; then
  # The cached SQLite objects sit beside the cached runtime and take what it takes.
  case "$profile" in
    debug|speed|size) ;;
    *) echo "error: --sqlite-objects and --sqlite-from take the debug, speed and size profiles, not '$profile'" >&2; exit 2 ;;
  esac
  [ ${#pgo[@]} -eq 0 ] || { echo "error: --sqlite-objects and --sqlite-from do not take --pgo-*" >&2; exit 2; }
  [ -z "$sqlite_to" ] || [ -z "$sqlite_from" ] || { echo "error: --sqlite-objects and --sqlite-from are two different builds" >&2; exit 2; }
  [ -z "$sqlite_to" ] || [ -z "$objects_to$objects_from" ] || { echo "error: --sqlite-objects compiles runtime/sqlite/ alone, without --runtime-objects or --runtime-from" >&2; exit 2; }
fi
[ -n "$out" ] || [ -n "$objects_to" ] || [ -n "$sqlite_to" ] || { echo "error: -o <out> is required" >&2; exit 2; }

# The runtime is ten translation units, and a caller names one: whoever passes
# <dir>/runtime.c gets <dir>/runtime-os.c, <dir>/runtime-parallel.c,
# <dir>/runtime-cross.c, <dir>/runtime-host.c, <dir>/runtime-net.c, <dir>/runtime-simd.c,
# <dir>/runtime-aes.c, <dir>/runtime-term.c and <dir>/runtime-bytes.c compiled beside it, on every profile,
# wasi included: runtime-simd.c and runtime-bytes.c take their scalar paths there
# unless the build adds -msimd128,
# runtime-aes.c compiles to an answer of 0 and stubs that nothing calls,
# because the compiler emits no call to its kernels for wasm32, and
# runtime-term.c reads stdin and answers "not a terminal". They were one file until the
# operating-system half was split out for its own size budget, and the parallel
# half followed for the same reason (each file's header comment says why), and
# a link line is where those splits
# would otherwise leak: `nish --link` builds its command line in
# src/compile.ts, the published package's recipe in every document and
# README names runtime.c, and a user's own clang line does too. Pairing them
# here keeps every one of those correct, and keeps "the runtime" one thing to
# name from the outside. A caller that names one itself is left alone, because
# naming one object twice is a duplicate-symbol error.
halves="runtime-os.c runtime-parallel.c runtime-cross.c runtime-host.c runtime-net.c runtime-simd.c runtime-aes.c runtime-term.c runtime-bytes.c"
for i in ${inputs[@]+"${inputs[@]}"}; do
  case "$i" in
    */runtime.c|runtime.c)
      for half in $halves; do
        side="${i%runtime.c}$half"
        have=0
        for j in "${inputs[@]}"; do
          if [ "$j" = "$side" ]; then have=1; fi
        done
        if [ "$have" = 0 ] && [ -f "$side" ]; then inputs+=("$side"); fi
      done ;;
  esac
done

# SQLite (runtime/sqlite/) is an optional unit, and the IR selects it. A module
# that declares a function of SQLite's C API (`sqlite3_*`) or of the adapter
# beside it (`nishsqlite_*`) gets every runtime/sqlite/*.c compiled and
# linked. Any other program compiles none of it, so its link line and binary
# stay as they were. The test reads `declare` lines, and only before the first
# `"` on one, rather than any `@sqlite3_` in the file, because a string
# constant or a quoted name may hold one. It is one rule with `callsSqlite` in
# src/run-cache.ts, which decides whether a link asks the runtime cache for
# SQLite's objects; change both or neither. A caller
# that names a runtime/sqlite/*.c input itself is left alone, as `halves`
# leaves a runtime half: naming one object twice is a duplicate-symbol error.
# A tree without the directory still links every program that does not call it.
sqlite_dir="$(cd "$(dirname "$0")/../runtime/sqlite" 2>/dev/null && pwd -P)" || sqlite_dir=""
sqlite_wanted=0
if [ -n "$sqlite_to" ]; then
  if [ ${#inputs[@]} -gt 0 ]; then
    echo "error: --sqlite-objects compiles runtime/sqlite/ alone, not ${inputs[0]}" >&2; exit 2
  fi
  sqlite_wanted=1
fi
for i in ${inputs[@]+"${inputs[@]}"}; do
  case "$i" in
    *.ll) if grep -Eq '^declare [^"]*@(sqlite3|nishsqlite)_' "$i"; then sqlite_wanted=1; fi ;;
  esac
done
for i in ${inputs[@]+"${inputs[@]}"}; do
  case "$i" in
    *.c) if [ -n "$sqlite_dir" ] && [ "$(cd "$(dirname -- "$i")" && pwd -P)" = "$sqlite_dir" ]; then sqlite_wanted=0; break; fi ;;
  esac
done
if [ "$sqlite_wanted" = 1 ] && [ -z "$sqlite_dir" ]; then
  echo "error: the module calls SQLite, and $(dirname "$0")/../runtime/sqlite/ is not there" >&2
  exit 2
fi
if [ "$sqlite_wanted" = 1 ] && [ "$profile" = wasm ]; then
  echo "error: the module calls SQLite, which the wasm profile cannot link: it has no libc for runtime/sqlite/sqlite3.c to build on; use --profile wasi" >&2
  exit 2
fi

CC=${CC:-clang}
common=(-Wno-override-module)          # our IR is target-neutral; clang fills the triple in
elf=()                                 # flags that only make sense for ELF targets

# Platform-specific dead-stripping, symbol stripping and LTO linker selection.
case "$(uname -s)" in
  Darwin)
    # ld64: -dead_strip is the --gc-sections equivalent, -x drops local symbols
    # (-s is deprecated on macOS). No -fuse-ld=lld: ld64 does LTO natively.
    #
    # NOT -no_uuid, however tempting it looks from the reproducibility side.
    # LC_UUID is what made two links of one input differ here -- measured, on
    # both darwin rows (docs/wp10-ci.md#ci-matrix) -- and dropping it does make
    # them identical, and the binary then does not run: on arm64 dyld refuses
    # an image with no LC_UUID outright, `missing LC_UUID load command`
    # followed by SIGABRT, so the stage1 that linked went on to abort the
    # moment the bootstrap ran it. Measured too, on the run after the one that
    # named the UUID. An unloadable compiler is worse than any reproducibility,
    # so the UUID stays. The ELF branch's --build-id=none below is the flag
    # this would have been; ELF has no loader that insists on one.
    #
    # It costs nothing, because the UUID was measured stable across two links
    # of one input to one output path, and differing on a link to another. That
    # is what scripts/bootstrap.sh links every comparable stage at one path for,
    # and it is why `stage3 == stage2` holds on Mach-O with the load command in.
    # shellcheck disable=SC2054 # -Wl,<flag> is one argument: the comma is the linker's
    gc=(-Wl,-dead_strip)
    # shellcheck disable=SC2054
    strip_flag=(-Wl,-x) ;;
  *)
    # shellcheck disable=SC2054 # -Wl,<flag> is one argument: the comma is the linker's
    gc=(-Wl,--gc-sections -Wl,--as-needed -Wl,-O2 -Wl,--build-id=none); strip_flag=(-s)
    elf=(-fno-plt)
    # GNU ld needs the gold plugin for LTO; prefer lld when clang can find it.
    if command -v ld.lld >/dev/null 2>&1; then common+=(-fuse-ld=lld); fi ;;
esac

# -g: compile everything with debug info and never strip, whatever the profile,
# so the line table nish emitted survives into the binary.
if [ "$debug" = 1 ]; then common+=(-g); strip_flag=(); fi

# --threads: the storage class of the arena is ABI, so every input is compiled
# with the same macro -- C runtime and generated N-API shim alike.
#
# -ftls-model=initial-exec names, for the C side, the model the IR already
# names. Without it a -fPIC build (the napi profile) reaches the arena through
# a __tls_get_addr call, so the two halves of one inlined allocator would use
# two different models; it is also smaller (4,759 bytes of runtime.c `.text*`
# against 4,820 at -Oz -fPIC) and free where the model was local-exec anyway.
#
# `tls` is the same pair again for the wasm and wasi profiles, which build their
# own command line instead of using `common`; it is empty on every ordinary
# build, hence the bash 3.2 expansion spelling explained below.
#
# -pthread is for runtime-parallel.c, the translation unit that divides a range
# of work across threads: it is compiled in either configuration and only spawns
# under this macro, so this is the build where the flag has to be on the command
# line. On a current glibc the library half is already inside libc and the link
# would succeed without it; passing it is what makes that an implementation
# detail rather than something the build depends on.
#
# It is deliberately in `common` and not in `tls`: `tls` is the wasm and wasi
# command lines, which have no threads to link against, and where
# runtime-parallel.c compiles to its sequential fallback because it tests
# __wasi__ and __wasm__ as well as the macro.
# --cpu: every unit at the one level, so the module, the runtime and the link
# (LTO generates code there) agree. -ffp-contract=off keeps the meaning fixed:
# v3 has FMA, and contracting a*b+c into one rounding would print a different
# float than the baseline build (docs/LANGUAGE.md, "The CPU level").
if [ -n "$cpu" ]; then common+=(-march=x86-64-v3 -ffp-contract=off); fi

tls=()
if [ "$threads" = 1 ]; then
  common+=(-DNISH_THREADS=1 -ftls-model=initial-exec -pthread)
  tls=(-DNISH_THREADS=1 -ftls-model=initial-exec)
fi

# What the speed and size profiles compile every input with, beside `common`.
# One list per profile, because the runtime cache below compiles with exactly
# what the one-command link does, and two copies of a flag set drift.
optimise=()
case "$profile" in
  speed)
    optimise=(-O3 -flto -DNDEBUG ${pgo[@]+"${pgo[@]}"}
      -ffunction-sections -fdata-sections -fomit-frame-pointer
      -fno-asynchronous-unwind-tables -fno-unwind-tables ${elf[@]+"${elf[@]}"}) ;;
  size)
    optimise=(-Oz -flto -DNDEBUG ${pgo[@]+"${pgo[@]}"}
      -ffunction-sections -fdata-sections -fomit-frame-pointer
      -fno-asynchronous-unwind-tables -fno-unwind-tables ${elf[@]+"${elf[@]}"}
      -fno-stack-protector -fvisibility=hidden) ;;
  napi)
    optimise=(-O3 -flto -DNDEBUG ${pgo[@]+"${pgo[@]}"}
      -ffunction-sections -fdata-sections -fomit-frame-pointer
      -fno-asynchronous-unwind-tables -fno-unwind-tables ${elf[@]+"${elf[@]}"}) ;;
esac

# --runtime-objects and --runtime-from: the one-command link split in two, with
# every compile it held run at once. A `$CC -c` takes `common` and `optimise`,
# which is what the one command compiles each input with -- less
# -fuse-ld=lld, which only names the linker -- so a runtime unit compiles to the
# same object either way: native code for debug, -flto bitcode for speed and
# size, which the link still optimises together with the program. The link
# takes the same line the profile always uses, with objects for sources.
compile=()
for flag in "${common[@]}"; do
  case "$flag" in -fuse-ld=*) ;; *) compile+=("$flag") ;; esac
done
compile+=(${optimise[@]+"${optimise[@]}"})
# Waits for every job, not just the last, and fails when any of them did.
# bash 3.2 has no `wait -n`, so the jobs are waited for in order.
pids=()
join_jobs() {
  local failed=0 pid
  for pid in ${pids[@]+"${pids[@]}"}; do
    wait "$pid" || failed=1
  done
  pids=()
  return "$failed"
}
# The compiles are this script's children, so a signal that stops it stops
# them too, before anything they write into is removed. A finished script
# has waited for every one of them, so there is nothing left to stop.
stop_jobs() {
  if [ ${#pids[@]} -gt 0 ]; then
    kill "${pids[@]}" 2>/dev/null || true
    wait "${pids[@]}" 2>/dev/null || true
    pids=()
  fi
}
work=""
trap 'stop_jobs; [ -z "$work" ] || rm -rf -- "$work"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# A link's own objects go in a private directory of its own and go with it.
make_work() {
  [ -n "$work" ] || work=$(mktemp -d "${TMPDIR:-/tmp}/nish-link.XXXXXX")
}
# A CC named by a relative path is named from here, not from a unit's directory.
case "$CC" in /*) ;; */*) CC="$(pwd)/$CC" ;; esac

# SQLite's compile-time options (https://sqlite.org/compile.html): the set the
# SQLite project recommends for a program that needs none of the legacy
# behaviours, less two of it. SQLITE_OMIT_DECLTYPE is left out because it
# removes sqlite3_column_decltype, which a binding reads to tell a column's
# declared type. SQLITE_OMIT_AUTOINIT is left out because it makes a call
# before sqlite3_initialize() undefined behaviour, and the check it saves is
# a branch in a few entry points. Double-quoted strings are identifiers only. There are no memory
# statistics, no progress callback, no shared cache and no loadable extensions.
# Expression depth is bounded by the stack, not a counter. A program has one
# thread unless it was built with --threads. SQLite takes no mutex for one
# thread (THREADSAFE=0). Under --threads it is multi-thread mode (=2): no mutex
# guards a connection, so a program must not share one across threads. wasi
# has no threads, so it gets 0 whatever the module says. NISH_SQLITE_CFLAGS is
# appended: `read` takes its first line and splits it on whitespace, so a
# word cannot hold a space and a quote is an ordinary character. A relative
# path in it (-Iinclude) resolves against runtime/sqlite/, the directory every
# unit is compiled from. A -D or -U in it for one of these names replaces the
# default, so the compile does not warn about a macro defined twice.
if [ "$threads" = 1 ] && [ "$profile" != wasi ]; then sqlite_threadsafe=2; else sqlite_threadsafe=0; fi
sqlite_extra=()
read -r -a sqlite_extra <<< "${NISH_SQLITE_CFLAGS:-}"
sqlite_defs=()
for d in -DSQLITE_DQS=0 -DSQLITE_DEFAULT_MEMSTATUS=0 -DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1 \
         -DSQLITE_LIKE_DOESNT_MATCH_BLOBS -DSQLITE_MAX_EXPR_DEPTH=0 -DSQLITE_OMIT_DEPRECATED \
         -DSQLITE_OMIT_PROGRESS_CALLBACK -DSQLITE_OMIT_SHARED_CACHE -DSQLITE_USE_ALLOCA \
         -DSQLITE_OMIT_LOAD_EXTENSION "-DSQLITE_THREADSAFE=$sqlite_threadsafe"; do
  name=${d#-D}; name=${name%%=*}
  keep=1
  for e in ${sqlite_extra[@]+"${sqlite_extra[@]}"}; do
    case "$e" in "-D$name"|"-D$name="*|"-U$name") keep=0 ;; esac
  done
  if [ "$keep" = 1 ]; then sqlite_defs+=("$d"); fi
done
sqlite_defs+=(${sqlite_extra[@]+"${sqlite_extra[@]}"})

# Compiles every runtime/sqlite/*.c with the flags given, all at once, into
# $1/<unit>.o. Each unit is compiled from inside runtime/sqlite/ by its bare
# name, as the runtime is, so -g's DWARF names no directory the link was
# started in. sqlite3.c, the 9.6 MB amalgamation, is compiled to native code
# even where the profile compiles to LTO bitcode. As bitcode, every link of a
# program that uses it would generate its code again: measured on a program
# that opens a database and runs a query, that is 10.6 s a link at -O3,
# against 0.04 s for the native object. The adapter beside it stays LTO, and
# it is what inlines into the program. So `-flto` comes off for that one unit
# alone.
sqlite_units() {
  local to=$1 unit flag
  local -a flags
  shift
  for unit in "$sqlite_dir"/*.c; do
    unit=${unit##*/}
    flags=()
    for flag in "$@"; do
      case "$unit:$flag" in sqlite3.c:-flto) ;; *) flags+=("$flag") ;; esac
    done
    (cd -- "$sqlite_dir" && exec "$CC" "${flags[@]}" "${sqlite_defs[@]}" -I. -c "$unit" -o "$to/${unit%.c}.o") &
    pids+=("$!")
  done
  join_jobs || { echo "error: runtime/sqlite/ did not compile" >&2; exit 1; }
}
# Adds the objects of runtime/sqlite/ to this link, in the order of the units.
# They are compiled into the link's own directory with the flags given, or
# taken from --sqlite-from. Nothing is added for a module that does not call
# SQLite.
sqlite_objects() {
  local from=$sqlite_from unit
  [ "$sqlite_wanted" = 1 ] || return 0
  if [ -z "$from" ]; then
    make_work
    from="$work/sqlite"
    mkdir -p -- "$from"
    sqlite_units "$from" "$@"
  fi
  for unit in "$sqlite_dir"/*.c; do
    unit=${unit##*/}
    [ -f "$from/${unit%.c}.o" ] || { echo "error: --sqlite-from: $from/${unit%.c}.o is missing" >&2; exit 2; }
    inputs+=("$from/${unit%.c}.o")
  done
}

if [ -n "$sqlite_to" ]; then
  mkdir -p -- "$sqlite_to"
  sqlite_to=$(cd -- "$sqlite_to" && pwd)
  sqlite_units "$sqlite_to" "${compile[@]}"
  exit 0
fi

if [ -n "$objects_to" ]; then
  runtime=""
  for i in "${inputs[@]}"; do
    case "$i" in
      */runtime.c|runtime.c) runtime="$i" ;;
      */runtime-*.c|runtime-*.c) ;;     # its siblings, added above
      *) echo "error: --runtime-objects compiles the runtime alone, not $i" >&2; exit 2 ;;
    esac
  done
  [ -n "$runtime" ] || { echo "error: --runtime-objects needs runtime/runtime.c" >&2; exit 2; }
  mkdir -p -- "$objects_to"
  objects_to=$(cd -- "$objects_to" && pwd)
  # Each unit is compiled from inside its own directory, by its bare name, so
  # an object holds no trace of where the compile was started: -g's DWARF names
  # the file `runtime.c` in the runtime's own directory, whichever directory
  # the first link that compiled it was run in.
  runtime_dir=$(dirname -- "$runtime")
  for unit in runtime.c $halves; do
    (cd -- "$runtime_dir" && exec "$CC" "${compile[@]}" -c "$unit" -o "$objects_to/${unit%.c}.o") &
    pids+=("$!")
  done
  join_jobs || { echo "error: the runtime did not compile" >&2; exit 1; }
  exit 0
fi

if [ -n "$objects_from" ]; then
  for unit in runtime.c $halves; do
    [ -f "$objects_from/${unit%.c}.o" ] || { echo "error: --runtime-from: $objects_from/${unit%.c}.o is missing" >&2; exit 2; }
  done
  make_work
  objects=()
  n=0
  for i in "${inputs[@]}"; do
    case "$i" in */runtime.c|runtime.c) echo "error: --runtime-from links the runtime in $objects_from, so $i is not an input" >&2; exit 2 ;; esac
    n=$((n + 1))
    "$CC" "${compile[@]}" -c "$i" -o "$work/$n.o" &
    pids+=("$!")
    objects+=("$work/$n.o")
  done
  join_jobs || { echo "error: a module did not compile" >&2; exit 1; }
  # In the order the one-command link names them: the inputs, then runtime.c
  # and its siblings.
  for unit in runtime.c $halves; do
    objects+=("$objects_from/${unit%.c}.o")
  done
  inputs=("${objects[@]}")
  # clang runs dsymutil itself when one command compiles and links with -g on
  # macOS; a link of objects does not, so it is run here, while the program's
  # objects the debug map points at are still there.
  if [ "$debug" = 1 ] && [ "$(uname -s)" = Darwin ]; then dsym=1; else dsym=0; fi
fi

# The ${arr[@]+"${arr[@]}"} spelling below is not a style tic: macOS ships bash
# 3.2 (Apple will not ship GPLv3), where expanding an empty array as "${arr[@]}"
# under `set -u` is a fatal "unbound variable" -- bash 4.4 made it legal, which is
# why Linux never noticed. `pgo`, `elf`, `strip_flag` and `libs` are all empty on
# ordinary builds, so please do not simplify these back.
case "$profile" in debug|speed|size) sqlite_objects "${compile[@]}" ;; esac
case "$profile" in
  debug)
    "$CC" "${common[@]}" "${inputs[@]}" -lm -o "$out" ;;
  speed|size)
    "$CC" "${common[@]}" "${optimise[@]}" \
      "${gc[@]}" ${strip_flag[@]+"${strip_flag[@]}"} "${inputs[@]}" -lm -o "$out" ;;
  wasm)
    # clang resolves wasm-ld next to its own binary first, then on PATH; ask it
    # rather than probing PATH so a Homebrew llvm without a PATH entry still works.
    wasm_ld=$("$CC" -print-prog-name=wasm-ld)
    if [ ! -x "$wasm_ld" ]; then
      echo "error: the wasm profile needs wasm-ld (install lld; on macOS: brew install llvm@18)" >&2
      exit 2
    fi
    # IR compiled for the host rather than with `--target wasm32` calls std/crypto/aes.ts's
    # AES kernels behind `nish_aes_hw` (src/kernels.ts). runtime-aes.c's wasm32 build
    # answers 0 there, so the bitsliced code runs, and it is added only for such IR:
    # every other module links the bytes it always did.
    # A caller that names runtime-aes.c itself is left alone, as `halves` leaves it:
    # one object named twice is a duplicate-symbol error.
    aes_named=0
    aes_wanted=0
    for i in ${inputs[@]+"${inputs[@]}"}; do
      case "$i" in
        */runtime-aes.c|runtime-aes.c) aes_named=1 ;;
        *.ll) if grep -q '@nish_aes_hw(' "$i"; then aes_wanted=1; fi ;;
      esac
    done
    if [ "$aes_wanted" = 1 ] && [ "$aes_named" = 0 ]; then
      inputs+=("$(cd "$(dirname "$0")/../runtime" && pwd)/runtime-aes.c")
    fi
    # IR of either kind that imports std/json or calls nish/bytes's byte-class runs
    # calls runtime-bytes.c's kernels (src/kernels.ts), which compile freestanding:
    # the scalar path, or the 128-bit one under -msimd128. It is added the same way,
    # only for such IR and only when the caller has not named it.
    bytes_named=0
    bytes_wanted=0
    for i in ${inputs[@]+"${inputs[@]}"}; do
      case "$i" in
        */runtime-bytes.c|runtime-bytes.c) bytes_named=1 ;;
        *.ll) if grep -q '@nish_bytes_skip_' "$i"; then bytes_wanted=1; fi ;;
      esac
    done
    if [ "$bytes_wanted" = 1 ] && [ "$bytes_named" = 0 ]; then
      inputs+=("$(cd "$(dirname "$0")/../runtime" && pwd)/runtime-bytes.c")
    fi
    # -mbulk-memory lowers llvm.memset/memcpy (`new Array<T>(n)`, `push` growth) to the
    # memory.fill/memory.copy instructions instead of libc calls the freestanding link lacks.
    "$CC" -Wno-override-module --target=wasm32-unknown-unknown -Oz -nostdlib -mbulk-memory \
      ${tls[@]+"${tls[@]}"} \
      -Wl,--no-entry -Wl,--export-all -Wl,--strip-all -Wl,--gc-sections \
      "${inputs[@]}" -o "$out" ;;
  wasi)
    sysroot=${WASI_SYSROOT:-}
    for d in /usr/lib/wasi-sysroot /opt/wasi-sdk/share/wasi-sysroot /usr/share/wasi-sysroot; do
      [ -n "$sysroot" ] || { [ -d "$d" ] && sysroot=$d; }
    done
    if [ -z "$sysroot" ] || [ ! -d "$sysroot/lib" ]; then
      echo "error: the wasi profile needs a WASI sysroot (wasi-libc headers and libc.a) and none was found." >&2
      echo "       Install wasi-sdk's sysroot (https://github.com/WebAssembly/wasi-sdk/releases: wasi-sysroot-<ver>.tar.gz," >&2
      echo "       or apt install wasi-libc) and set WASI_SYSROOT=<dir> if it is not in one of the default locations" >&2
      echo "       (/usr/lib/wasi-sysroot, /opt/wasi-sdk/share/wasi-sysroot, /usr/share/wasi-sysroot). See docs/INSTALL.md." >&2
      exit 2
    fi
    wasm_ld=$("$CC" -print-prog-name=wasm-ld)
    if [ ! -x "$wasm_ld" ]; then
      echo "error: the wasi profile needs wasm-ld (install lld; on macOS: brew install llvm@18)" >&2
      exit 2
    fi
    # clang links compiler-rt's wasm32 builtins from its resource dir (wasi-sdk and Debian's
    # libclang-rt-<ver>-dev-wasm32 put it there); wasi-libc's strtoll needs its __multi3.
    # Otherwise look for wasi-sdk's separate libclang_rt.builtins-wasm32-wasi-<ver>.tar.gz
    # unpacked next to the sysroot, or WASI_BUILTINS=<file>, and name libc explicitly
    # (wasi-libc's libc.a includes libm) so clang stops looking for the archive itself.
    libs=()
    if [ ! -f "$("$CC" -print-resource-dir)/lib/wasi/libclang_rt.builtins-wasm32.a" ]; then
      for f in "${WASI_BUILTINS:-}" "$sysroot/lib/wasm32-wasi/libclang_rt.builtins-wasm32.a" \
               "$sysroot/lib/libclang_rt.builtins-wasm32.a" "$sysroot"/../libclang_rt.builtins-wasm32*/libclang_rt.builtins-wasm32.a; do
        if [ -n "$f" ] && [ -f "$f" ]; then libs=(-nodefaultlibs -lc "$f"); break; fi
      done
      if [ ${#libs[@]} -eq 0 ]; then
        echo "error: the wasi profile needs compiler-rt's wasm32 builtins (libclang_rt.builtins-wasm32.a) and clang has none." >&2
        echo "       Install libclang-rt-<ver>-dev-wasm32, or unpack wasi-sdk's libclang_rt.builtins-wasm32-wasi-<ver>.tar.gz" >&2
        echo "       into $sysroot/lib/wasm32-wasi/ or point WASI_BUILTINS at the .a file. See docs/INSTALL.md." >&2
        exit 2
      fi
    fi
    # SQLite builds on wasi-libc as it is: the amalgamation sees __wasi__ and
    # takes dot-file locking, no mmap and no WAL shared memory.
    sqlite_objects --target=wasm32-wasi --sysroot="$sysroot" -Oz -DNDEBUG \
      ${tls[@]+"${tls[@]}"} -ffunction-sections -fdata-sections
    "$CC" -Wno-override-module --target=wasm32-wasi --sysroot="$sysroot" -Oz -DNDEBUG \
      ${tls[@]+"${tls[@]}"} \
      -ffunction-sections -fdata-sections -Wl,--gc-sections -Wl,--strip-all \
      "${inputs[@]}" ${libs[@]+"${libs[@]}"} -o "$out" ;;
  napi)
    # Node ships its C headers next to the binary: <prefix>/bin/node and
    # <prefix>/include/node/node_api.h (official tarballs, nvm, fnm, volta).
    # Distro packages put them in libnode-dev; NODE_INCLUDE overrides the guess.
    node_bin=${NODE:-node}
    node_inc=${NODE_INCLUDE:-}
    if [ -z "$node_inc" ]; then
      node_inc=$("$node_bin" -p "require('path').dirname(process.execPath) + '/../include/node'" 2>/dev/null || true)
    fi
    if [ -z "$node_inc" ] || [ ! -f "$node_inc/node_api.h" ]; then
      echo "error: the napi profile needs the Node headers, but ${node_inc:-<node not found>}/node_api.h does not exist." >&2
      echo "       Install Node from nodejs.org/nvm (they ship include/node), or apt install libnode-dev and" >&2
      echo "       set NODE_INCLUDE=/usr/include/node (any directory that contains node_api.h)." >&2
      exit 2
    fi
    shared=(-shared -fPIC)
    # macOS: the napi_* symbols come from the node binary at load time, so the
    # linker must not insist on resolving them. ELF shared objects allow this.
    # shellcheck disable=SC2054 # -Wl,<flag> is one argument: the comma is the linker's
    case "$(uname -s)" in Darwin) shared+=(-Wl,-undefined,dynamic_lookup) ;; esac
    # runtime/nish.h is the public ABI header the generated shim includes.
    runtime_inc="$(cd "$(dirname "$0")/../runtime" && pwd)"
    # SQLite's API stays inside the addon: a Node linked against a system
    # libsqlite3 exports the same names, and a call bound to that copy would
    # run another version with other options.
    sqlite_objects "${compile[@]}" -fPIC -fvisibility=hidden
    "$CC" "${common[@]}" "${optimise[@]}" -I"$node_inc" -I"$runtime_inc" \
      "${shared[@]}" "${gc[@]}" ${strip_flag[@]+"${strip_flag[@]}"} "${inputs[@]}" -lm -o "$out" ;;
  *) echo "error: unknown profile '$profile'" >&2; exit 2 ;;
esac

if [ "${dsym:-0}" = 1 ]; then "$("$CC" -print-prog-name=dsymutil)" "$out"; fi

# `wc -c` pads with spaces on macOS; strip them so the number is clean.
printf '%s: %s bytes (%s)\n' "$out" "$(wc -c < "$out" | tr -d ' ')" "$profile"
