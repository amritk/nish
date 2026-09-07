#!/usr/bin/env bash
# The self-hosted compiler's command line.
#
#   scripts/statictsc.sh <entry.ts> [-o <out.ll> | -o <dir>/] [--link <exe>]
#                        [--profile speed|size|debug|wasi] [compiler flags...]
#
# The compiler this drives is `self/` compiled by `self/`
# (scripts/bootstrap.sh). It emits `.ll` and nothing else: creating a directory
# and shelling out to a linker would mean `mkdirSync` and `spawnSync` builtins
# and real runtime growth, so docs/wp14-selfhost.md D4 keeps that half of the
# driver out of the compiler and puts it here. What this script adds is exactly
# that half, and it mirrors stage0's spelling of it:
#
#   -o <dir>/       creates the directory, then `--out-dir <dir>`
#   -o <file.ll>    the one module's IR, moved into place
#   (neither)       <entry>.ll, next to the source, as stage0 defaults
#   --link <exe>    <exe>.ll (or <exe>.modules/ for a program with imports),
#                   then scripts/build.sh with runtime/runtime.c
#   --profile <p>   the link profile (default: speed)
#
# Every other flag goes straight to the compiler. The flags that are stage0's
# rather than missing — the interop sidecars, `-g`, the dumps — are refused by
# name with what to run instead, because a flag that is quietly ignored is how
# a build ends up not carrying the thing it asked for.
#
# STATICTSC=<binary> picks the compiler (default: build/statictsc).
# Exit codes match stage0's: 0 ok, 1 compile error, 2 usage, 3 toolchain.
set -uo pipefail
cd "$(dirname "$0")/.."

compiler=${STATICTSC:-build/statictsc}
entry=""
output=""
link=""
profile=speed
flags=()

usage() {
  cat <<'EOF'
usage: scripts/statictsc.sh <entry.ts> [-o <out.ll>|<dir>/] [--link <exe>]
                            [--profile speed|size|debug|wasi] [compiler flags...]
Drives the self-hosted compiler (build/statictsc, or $STATICTSC) and adds the
directory creation and the link step it does not do itself (wp14 D4).
Compiler flags: --number-mode i32|f64, --plain, --strict-exports, --nsw,
--no-stack-alloc, --unchecked-indexing, --runtime-decls, --target <triple>.
EOF
  exit "${1:-2}"
}

stage0_only() {
  echo "statictsc.sh: \`$1\` is stage0's (docs/wp14-selfhost.md D4); run \`node dist/index.js\` for it" >&2
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
    -o|--output) output="${2:-}"; [ -n "$output" ] || usage; shift 2 ;;
    --link) link="${2:-}"; [ -n "$link" ] || usage; shift 2 ;;
    --profile) profile="${2:-}"; [ -n "$profile" ] || usage; shift 2 ;;
    -h|--help) usage 0 ;;
    -g|--emit-header|--emit-dts|--emit-napi|--emit-ast|--emit-checked|--json|-v|--version)
      stage0_only "$1" ;;
    --number-mode|--target) flags+=("$1" "${2:-}"); [ -n "${2:-}" ] || usage; shift 2 ;;
    -*) flags+=("$1"); shift ;;
    *) entry="$1"; shift ;;
  esac
done

[ -n "$entry" ] || usage
if [ ! -x "$compiler" ]; then
  echo "statictsc.sh: no compiler at \`$compiler\`; run \`npm run bootstrap\` (or set STATICTSC)" >&2
  exit 3
fi
if [ -n "$link" ] && [ -n "$output" ]; then
  echo "statictsc.sh: --link picks where the IR goes; pass one of -o and --link" >&2
  exit 2
fi

# Where the IR goes. `--link` and a trailing `/` both mean a directory; a plain
# -o is one module's text, which the compiler writes to stdout.
dir=""
if [ -n "$link" ]; then
  mkdir -p "$(dirname "$link")"
  dir="$link.modules"
elif [ -n "$output" ]; then
  case "$output" in
    */) dir="${output%/}" ;;
  esac
else
  output="${entry%.ts}.ll"
fi

# Everything compiles into a directory, whether or not one was asked for: it
# is the only shape that works for a program with imports, and a `-o <file.ll>`
# is then the one module moved into place. A failed compile therefore leaves no
# half-written `.ll` behind.
single=""
if [ -z "$dir" ]; then
  single="$output"
  dir="$output.modules"
  mkdir -p "$(dirname "$output")"
fi
rm -rf "$dir"
mkdir -p "$dir"
"$compiler" "$entry" "${flags[@]+"${flags[@]}"}" --out-dir "$dir" >/dev/null
status=$?
if [ "$status" -ne 0 ]; then
  rm -rf "$dir"
  exit "$status"
fi

modules=("$dir"/*.ll)
if [ -n "$single" ]; then
  # stage0 refuses this layout rather than picking a module, and says so with
  # the names; mirror both the wording and its exit code.
  if [ "${#modules[@]}" -ne 1 ]; then
    echo "statictsc.sh: ${#modules[@]} modules would be written; pass \`-o <dir>/\` to write one .ll per module" >&2
    rm -rf "$dir"
    exit 1
  fi
  mv "${modules[0]}" "$single"
  rmdir "$dir"
  echo "wrote $single"
fi

[ -n "$link" ] || exit 0

# stage0 writes a single-module program's IR as `<exe>.ll` rather than a
# directory of one; mirror that, so the two compilers leave the same files.
if [ "${#modules[@]}" -eq 1 ]; then
  mv "${modules[0]}" "$link.ll"
  rmdir "$dir"
  modules=("$link.ll")
fi

if ! bash scripts/build.sh "${modules[@]}" runtime/runtime.c -o "$link" --profile "$profile"; then
  echo "statictsc.sh: --link: scripts/build.sh failed; the IR is in ${modules[*]}" >&2
  exit 3
fi
