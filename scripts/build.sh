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
#   wasm   wasm32 freestanding module exporting every non-internal function;
#          load it from Node. Add runtime/runtime_wasm.c to the inputs when a
#          function uses arrays (the arena and the array cold paths, no libc);
#          strings and I/O still need a WASI runtime and are not available.
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
# Debug info (WP10): `-g` compiles every input with -g and skips the strip
# step of the speed/size/napi profiles, so the DWARF that `statictsc -g`
# put in the .ll (line table, variables) reaches the binary. `statictsc
# --link -g` passes it through automatically.
#
# Works on Linux (clang + lld preferred, GNU ld tolerated) and macOS (Apple ld64
# or Homebrew llvm). Set CC to pick a compiler (default: clang on PATH).
set -euo pipefail

profile=speed
out=""
inputs=()
pgo=()                                 # -fprofile-generate / -fprofile-use=<file>
debug=0                                # -g: keep DWARF (statictsc -g emits it in the IR; runtime.c gets it here)
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    --profile) profile="$2"; shift 2 ;;
    -g) debug=1; shift ;;
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

# -g: compile everything with debug info and never strip, whatever the profile,
# so the line table statictsc emitted survives into the binary.
if [ "$debug" = 1 ]; then common+=(-g); strip_flag=(); fi

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
    # -mbulk-memory lowers llvm.memset/memcpy (`new Array<T>(n)`, `push` growth) to the
    # memory.fill/memory.copy instructions instead of libc calls the freestanding link lacks.
    "$CC" -Wno-override-module --target=wasm32-unknown-unknown -Oz -nostdlib -mbulk-memory \
      -Wl,--no-entry -Wl,--export-all -Wl,--strip-all -Wl,--gc-sections \
      "${inputs[@]}" -o "$out" ;;
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
