#!/usr/bin/env bash
# Build a StaticTS .ll module (plus optional C sources) into a native binary.
#
#   scripts/build.sh <module.ll> [more .ll/.c files...] -o <out> [--profile debug|speed|size|wasm]
#
# Profiles:
#   debug  clang defaults: no optimisation, symbols kept. The "before" number.
#   speed  -O3 + LTO + section GC + strip. Rust `--release` equivalent.
#   size   -Oz + LTO + section GC + strip + no unwind tables. Rust
#          `opt-level="z"`, `panic="abort"`, `strip=true` equivalent.
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
#          the shim from `statictsc --emit-napi`.
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
# Works on Linux (clang + lld preferred, GNU ld tolerated) and macOS (Apple ld64
# or Homebrew llvm). Set CC to pick a compiler (default: clang on PATH).
set -euo pipefail

profile=speed
out=""
inputs=()
pgo=()                                 # -fprofile-generate / -fprofile-use=<file>
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    --profile) profile="$2"; shift 2 ;;
    --pgo-generate) pgo=(-fprofile-generate); shift ;;
    --pgo-use)
      [ -f "$2" ] || { echo "error: --pgo-use: profile '$2' not found (run the instrumented binary, then llvm-profdata merge)" >&2; exit 2; }
      pgo=("-fprofile-use=$2"); shift 2 ;;
    -h|--help) sed -n '2,37p' "$0"; exit 0 ;;
    *) inputs+=("$1"); shift ;;
  esac
done
[ ${#inputs[@]} -gt 0 ] || { echo "error: no input files" >&2; exit 2; }
[ -n "$out" ] || { echo "error: -o <out> is required" >&2; exit 2; }

CC=${CC:-clang}
common=(-Wno-override-module)          # our IR is target-neutral; clang fills the triple in
elf=()                                 # flags that only make sense for ELF targets

# Platform-specific dead-stripping, symbol stripping and LTO linker selection.
case "$(uname -s)" in
  Darwin)
    # ld64: -dead_strip is the --gc-sections equivalent, -x drops local symbols
    # (-s is deprecated on macOS). No -fuse-ld=lld: ld64 does LTO natively.
    gc=(-Wl,-dead_strip); strip_flag=(-Wl,-x) ;;
  *)
    gc=(-Wl,--gc-sections -Wl,--as-needed -Wl,-O2 -Wl,--build-id=none); strip_flag=(-s)
    elf=(-fno-plt)
    # GNU ld needs the gold plugin for LTO; prefer lld when clang can find it.
    if command -v ld.lld >/dev/null 2>&1; then common+=(-fuse-ld=lld); fi ;;
esac

case "$profile" in
  debug)
    "$CC" "${common[@]}" "${inputs[@]}" -lm -o "$out" ;;
  speed)
    "$CC" "${common[@]}" -O3 -flto -DNDEBUG "${pgo[@]}" \
      -ffunction-sections -fdata-sections -fomit-frame-pointer \
      -fno-asynchronous-unwind-tables -fno-unwind-tables "${elf[@]}" \
      "${gc[@]}" "${strip_flag[@]}" "${inputs[@]}" -lm -o "$out" ;;
  size)
    "$CC" "${common[@]}" -Oz -flto -DNDEBUG "${pgo[@]}" \
      -ffunction-sections -fdata-sections -fomit-frame-pointer \
      -fno-asynchronous-unwind-tables -fno-unwind-tables "${elf[@]}" \
      -fno-stack-protector -fvisibility=hidden \
      "${gc[@]}" "${strip_flag[@]}" "${inputs[@]}" -lm -o "$out" ;;
  wasm)
    # clang resolves wasm-ld next to its own binary first, then on PATH; ask it
    # rather than probing PATH so a Homebrew llvm without a PATH entry still works.
    wasm_ld=$("$CC" -print-prog-name=wasm-ld)
    if [ ! -x "$wasm_ld" ]; then
      echo "error: the wasm profile needs wasm-ld (install lld; on macOS: brew install llvm@18)" >&2
      exit 2
    fi
    "$CC" -Wno-override-module --target=wasm32-unknown-unknown -Oz -nostdlib \
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
      -ffunction-sections -fdata-sections -Wl,--gc-sections -Wl,--strip-all \
      "${inputs[@]}" "${libs[@]}" -o "$out" ;;
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
    # runtime/statictsc.h is the public ABI header the generated shim includes.
    runtime_inc="$(cd "$(dirname "$0")/../runtime" && pwd)"
    "$CC" "${common[@]}" -O3 -flto -DNDEBUG "${pgo[@]}" -I"$node_inc" -I"$runtime_inc" \
      -ffunction-sections -fdata-sections -fomit-frame-pointer \
      -fno-asynchronous-unwind-tables -fno-unwind-tables "${elf[@]}" \
      "${shared[@]}" "${gc[@]}" "${strip_flag[@]}" "${inputs[@]}" -lm -o "$out" ;;
  *) echo "error: unknown profile '$profile'" >&2; exit 2 ;;
esac

# `wc -c` pads with spaces on macOS; strip them so the number is clean.
printf '%s: %s bytes (%s)\n' "$out" "$(wc -c < "$out" | tr -d ' ')" "$profile"
