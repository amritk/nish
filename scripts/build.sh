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
set -euo pipefail

profile=speed
out=""
inputs=()
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    --profile) profile="$2"; shift 2 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) inputs+=("$1"); shift ;;
  esac
done
[ ${#inputs[@]} -gt 0 ] || { echo "error: no input files" >&2; exit 2; }
[ -n "$out" ] || { echo "error: -o <out> is required" >&2; exit 2; }

CC=${CC:-clang}
common=(-Wno-override-module)          # our IR is target-neutral; clang fills the triple in

# Platform-specific dead-stripping and LTO linker selection.
case "$(uname -s)" in
  Darwin) gc=(-Wl,-dead_strip) ; strip_flag=(-Wl,-x) ;;
  *)      gc=(-Wl,--gc-sections -Wl,--as-needed -Wl,-O2 -Wl,--build-id=none) ; strip_flag=(-s)
          # GNU ld needs the gold plugin for LTO; prefer lld when present.
          if command -v ld.lld >/dev/null 2>&1; then common+=(-fuse-ld=lld); fi ;;
esac

case "$profile" in
  debug)
    "$CC" "${common[@]}" "${inputs[@]}" -o "$out" ;;
  speed)
    "$CC" "${common[@]}" -O3 -flto -DNDEBUG \
      -ffunction-sections -fdata-sections -fomit-frame-pointer \
      -fno-asynchronous-unwind-tables -fno-unwind-tables -fno-plt \
      "${gc[@]}" "${strip_flag[@]}" "${inputs[@]}" -o "$out" ;;
  size)
    "$CC" "${common[@]}" -Oz -flto -DNDEBUG \
      -ffunction-sections -fdata-sections -fomit-frame-pointer \
      -fno-asynchronous-unwind-tables -fno-unwind-tables -fno-plt \
      -fno-stack-protector -fvisibility=hidden \
      "${gc[@]}" "${strip_flag[@]}" "${inputs[@]}" -o "$out" ;;
  wasm)
    "$CC" -Wno-override-module --target=wasm32-unknown-unknown -Oz -nostdlib \
      -Wl,--no-entry -Wl,--export-all -Wl,--strip-all -Wl,--gc-sections \
      "${inputs[@]}" -o "$out" ;;
  *) echo "error: unknown profile '$profile'" >&2; exit 2 ;;
esac

printf '%s: %s bytes (%s)\n' "$out" "$(wc -c < "$out")" "$profile"
