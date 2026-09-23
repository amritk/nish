#!/usr/bin/env bash
# Build an Nish .ll module (plus optional C sources) into a native binary.
#
#   scripts/build.sh <module.ll> [more .ll/.c files...] -o <out> [--profile debug|speed|size|wasm]
#
# The C runtime is three translation units and is named as one: an input
# <dir>/runtime.c also compiles <dir>/runtime_os.c, the half that wraps the
# system calls (files, directories, subprocesses, the environment, the clock),
# and <dir>/runtime_parallel.c, the half that divides a range of work across
# threads. Each of those files says why they are compiled and measured apart.
#
# Profiles:
#   debug  clang defaults: no optimisation, symbols kept. The "before" number.
#   speed  -O3 + LTO + section GC + strip. Rust `--release` equivalent.
#   size   -Oz + LTO + section GC + strip + no unwind tables. Rust
#          `opt-level="z"`, `panic="abort"`, `strip=true` equivalent.
#   wasm   wasm32 freestanding module exporting every non-internal function;
#          load it from Node. Add runtime/runtime_wasm.c to the inputs when a
#          function uses arrays (the arena and the array cold paths, no libc);
#          strings and I/O still need a WASI runtime and are not available.
#   wasm   wasm32 freestanding module exporting every non-internal function
#          (for modules that do not use the C runtime); load it from Node.
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
# Works on Linux (clang + lld preferred, GNU ld tolerated) and macOS (Apple ld64
# or Homebrew llvm). Set CC to pick a compiler (default: clang on PATH).
set -euo pipefail

profile=speed
out=""
inputs=()
pgo=()                                 # -fprofile-generate / -fprofile-use=<file>
debug=0                                # -g: keep DWARF (nish -g emits it in the IR; runtime.c gets it here)
threads=0                              # --threads: -DNISH_THREADS, the thread-local arena (WP20 T0)
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    --profile) profile="$2"; shift 2 ;;
    -g) debug=1; shift ;;
    --threads) threads=1; shift ;;
    --pgo-generate) pgo=(-fprofile-generate); shift ;;
    --pgo-use)
      [ -f "$2" ] || { echo "error: --pgo-use: profile '$2' not found (run the instrumented binary, then llvm-profdata merge)" >&2; exit 2; }
      pgo=("-fprofile-use=$2"); shift 2 ;;
    -h|--help) sed -n '2,41p' "$0"; exit 0 ;;
    *) inputs+=("$1"); shift ;;
  esac
done
[ ${#inputs[@]} -gt 0 ] || { echo "error: no input files" >&2; exit 2; }
[ -n "$out" ] || { echo "error: -o <out> is required" >&2; exit 2; }

# The runtime is three translation units, and a caller names one: whoever passes
# <dir>/runtime.c gets <dir>/runtime_os.c and <dir>/runtime_parallel.c compiled
# beside it. They were one file until the operating-system half was split out
# for its own size budget, and the parallel half followed for the same reason
# (each file's header comment says why), and a link line is where those splits
# would otherwise leak: `nish --link` builds its command line in
# self/compile.ts, the published package's recipe in every document and
# README names runtime.c, and a user's own clang line does too. Pairing them
# here keeps every one of those correct, and keeps "the runtime" one thing to
# name from the outside. A caller that names one itself is left alone, because
# naming one object twice is a duplicate-symbol error.
for i in ${inputs[@]+"${inputs[@]}"}; do
  case "$i" in
    */runtime.c|runtime.c)
      for half in runtime_os.c runtime_parallel.c; do
        side="${i%runtime.c}$half"
        have=0
        for j in "${inputs[@]}"; do
          if [ "$j" = "$side" ]; then have=1; fi
        done
        if [ "$have" = 0 ] && [ -f "$side" ]; then inputs+=("$side"); fi
      done ;;
  esac
done

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
    gc=(-Wl,-dead_strip); strip_flag=(-Wl,-x) ;;
  *)
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
# -pthread is for runtime_parallel.c, the translation unit that divides a range
# of work across threads: it is compiled in either configuration and only spawns
# under this macro, so this is the build where the flag has to be on the command
# line. On a current glibc the library half is already inside libc and the link
# would succeed without it; passing it is what makes that an implementation
# detail rather than something the build depends on.
#
# It is deliberately in `common` and not in `tls`: `tls` is the wasm and wasi
# command lines, which have no threads to link against, and where
# runtime_parallel.c compiles to its sequential fallback because it tests
# __wasi__ and __wasm__ as well as the macro.
tls=()
if [ "$threads" = 1 ]; then
  common+=(-DNISH_THREADS=1 -ftls-model=initial-exec -pthread)
  tls=(-DNISH_THREADS=1 -ftls-model=initial-exec)
fi

# The ${arr[@]+"${arr[@]}"} spelling below is not a style tic: macOS ships bash
# 3.2 (Apple will not ship GPLv3), where expanding an empty array as "${arr[@]}"
# under `set -u` is a fatal "unbound variable" -- bash 4.4 made it legal, which is
# why Linux never noticed. `pgo`, `elf`, `strip_flag` and `libs` are all empty on
# ordinary builds, so please do not simplify these back.
case "$profile" in
  debug)
    "$CC" "${common[@]}" "${inputs[@]}" -lm -o "$out" ;;
  speed)
    "$CC" "${common[@]}" -O3 -flto -DNDEBUG ${pgo[@]+"${pgo[@]}"} \
      -ffunction-sections -fdata-sections -fomit-frame-pointer \
      -fno-asynchronous-unwind-tables -fno-unwind-tables ${elf[@]+"${elf[@]}"} \
      "${gc[@]}" ${strip_flag[@]+"${strip_flag[@]}"} "${inputs[@]}" -lm -o "$out" ;;
  size)
    "$CC" "${common[@]}" -Oz -flto -DNDEBUG ${pgo[@]+"${pgo[@]}"} \
      -ffunction-sections -fdata-sections -fomit-frame-pointer \
      -fno-asynchronous-unwind-tables -fno-unwind-tables ${elf[@]+"${elf[@]}"} \
      -fno-stack-protector -fvisibility=hidden \
      "${gc[@]}" ${strip_flag[@]+"${strip_flag[@]}"} "${inputs[@]}" -lm -o "$out" ;;
  wasm)
    # clang resolves wasm-ld next to its own binary first, then on PATH; ask it
    # rather than probing PATH so a Homebrew llvm without a PATH entry still works.
    wasm_ld=$("$CC" -print-prog-name=wasm-ld)
    if [ ! -x "$wasm_ld" ]; then
      echo "error: the wasm profile needs wasm-ld (install lld; on macOS: brew install llvm@18)" >&2
      exit 2
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
    case "$(uname -s)" in Darwin) shared+=(-Wl,-undefined,dynamic_lookup) ;; esac
    # runtime/nish.h is the public ABI header the generated shim includes.
    runtime_inc="$(cd "$(dirname "$0")/../runtime" && pwd)"
    "$CC" "${common[@]}" -O3 -flto -DNDEBUG ${pgo[@]+"${pgo[@]}"} -I"$node_inc" -I"$runtime_inc" \
      -ffunction-sections -fdata-sections -fomit-frame-pointer \
      -fno-asynchronous-unwind-tables -fno-unwind-tables ${elf[@]+"${elf[@]}"} \
      "${shared[@]}" "${gc[@]}" ${strip_flag[@]+"${strip_flag[@]}"} "${inputs[@]}" -lm -o "$out" ;;
  *) echo "error: unknown profile '$profile'" >&2; exit 2 ;;
esac

# `wc -c` pads with spaces on macOS; strip them so the number is clean.
printf '%s: %s bytes (%s)\n' "$out" "$(wc -c < "$out" | tr -d ' ')" "$profile"
