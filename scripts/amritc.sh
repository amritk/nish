#!/usr/bin/env bash
# The self-hosted compiler's command line.
#
#   scripts/amritc.sh <entry.ts> [-o <out.ll> | -o <dir>/] [--link <exe>]
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
#   -g              DWARF: stage1 puts it in the .ll, and this hands it to
#                   scripts/build.sh as well so runtime.c is compiled with it
#                   and the binary is not stripped, exactly as stage0's
#                   `--link -g` does
#
# Every other flag goes straight to the compiler, the interop sidecars
# (`--emit-header`, `--emit-dts`, `--emit-napi`) included: stage1 writes those
# itself now, to the path it was given. `--emit-checked` and `--version` it
# answers too, and because they print text rather than writing IR they skip the
# output planning and the link entirely.
#
# One flag is still stage0's rather than missing — `--emit-ast`, whose dump
# prints the `typescript` package's node names that stage1's own tree does not
# use — and it is refused by name with what to run
# instead, because a flag that is quietly ignored is how a build ends up not
# carrying the thing it asked for.
#
# AMRITC=<binary> picks the compiler (default: build/amritc).
# Exit codes match stage0's: 0 ok, 1 compile error, 2 usage, 3 toolchain.
set -uo pipefail
cd "$(dirname "$0")/.."

compiler=${AMRITC:-build/amritc}
entries=()
output=""
link=""
profile=speed
debug=0
dump=0
version=0
flags=()
sidecars=()

usage() {
  cat <<'EOF'
usage: scripts/amritc.sh <entry.ts> [-o <out.ll>|<dir>/] [--link <exe>]
                            [--profile speed|size|debug|wasi] [compiler flags...]
Drives the self-hosted compiler (build/amritc, or $AMRITC) and adds the
directory creation and the link step it does not do itself (wp14 D4).
Compiler flags: --number-mode i32|f64, --plain, --strict-exports, --nsw,
--no-stack-alloc, --unchecked-indexing, --runtime-decls, --target <triple>, -g,
--json, --emit-checked, --version, --emit-header <file.h>,
--emit-dts <file.d.ts>, --emit-napi <shim.c>.
EOF
  exit "${1:-2}"
}

stage0_only() {
  echo "amritc.sh: \`$1\` is stage0's (docs/wp14-selfhost.md D4); run \`node dist/index.js\` for it" >&2
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
    -o|--output) output="${2:-}"; [ -n "$output" ] || usage; shift 2 ;;
    --link) link="${2:-}"; [ -n "$link" ] || usage; shift 2 ;;
    --profile)
      profile="${2:-}"; [ -n "$profile" ] || usage
      # stage0 validates the profile before it compiles anything
      # (`PROFILES` in src/index.ts); passing it through unchecked would
      # spend the whole compile and then fail in scripts/build.sh.
      case "$profile" in
        speed|size|debug|wasi) ;;
        *) echo "amritc.sh: unknown profile \`$profile\` (speed, size, debug, wasi)" >&2; exit 2 ;;
      esac
      shift 2 ;;
    -h|--help) usage 0 ;;
    -g) debug=1; flags+=("-g"); shift ;;
    -v|--version) version=1; shift ;;
    --emit-checked) dump=1; flags+=("$1"); shift ;;
    --json) flags+=("$1"); shift ;;
    --emit-ast)
      stage0_only "$1" ;;
    --emit-header|--emit-dts|--emit-napi)
      [ -n "${2:-}" ] || usage
      flags+=("$1" "$2"); sidecars+=("$2"); shift 2 ;;
    --number-mode|--target) flags+=("$1" "${2:-}"); [ -n "${2:-}" ] || usage; shift 2 ;;
    -*) flags+=("$1"); shift ;;
    # Every positional is a root, as it is for stage0: the first is the entry
    # and the rest are modules nothing imports.
    *) entries+=("$1"); shift ;;
  esac
done

if [ ! -x "$compiler" ]; then
  echo "amritc.sh: no compiler at \`$compiler\`; run \`npm run bootstrap\` (or set AMRITC)" >&2
  exit 3
fi
# `--version` is the compiler's answer, not this script's, and it needs no
# entry: ask the binary so the version can never be this file's stale copy.
if [ "$version" -eq 1 ]; then
  exec "$compiler" --version
fi
[ "${#entries[@]}" -gt 0 ] || usage
entry="${entries[0]}"
if [ -n "$link" ] && [ -n "$output" ]; then
  echo "amritc.sh: --link picks where the IR goes; pass one of -o and --link" >&2
  exit 2
fi

# A dump asks the compiler for text on stdout rather than for IR, so there is
# no directory to make, nothing to move into place and nothing to link: hand the
# arguments straight over and let its exit status be ours.
if [ "$dump" -eq 1 ]; then
  exec "$compiler" "${entries[@]}" "${flags[@]+"${flags[@]}"}"
fi

# A sidecar is written where it was asked for, and the compiler makes no more
# of a directory for it than it does for the IR (D4). `--emit-dts` writes its
# companion loader beside the declarations, so one directory covers both.
for file in ${sidecars[@]+"${sidecars[@]}"}; do
  mkdir -p "$(dirname "$file")"
done

# Where the IR goes. `--link` and a trailing `/` both mean a directory; a plain
# -o is one module's text, which the compiler writes to stdout.
dir=""
if [ -n "$link" ]; then
  mkdir -p "$(dirname "$link")"
  # `<exe>.modules` is a name this script and stage0 both derive from `--link`
  # rather than one the caller chose, and the link below globs it, so a stale
  # `.ll` from an earlier build with more modules would be linked in. Clearing
  # it is safe for that reason and for that reason only — see the `-o <dir>/`
  # note below, where it would not be.
  dir="$link.modules"
  rm -rf "$dir"
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
#
# A directory the caller named is created and written into, never cleared:
# `-o build/` means "put the modules here", exactly as it does for stage0, and
# a script that emptied it first would take the rest of `build/` with it. The
# scratch directory the single-file case needs is this script's own, so it is
# made with `mktemp -d` and removed on the way out.
single=""
scratch=""
if [ -z "$dir" ]; then
  single="$output"
  mkdir -p "$(dirname "$output")"
  scratch=$(mktemp -d)
  dir="$scratch"
else
  mkdir -p "$dir"
fi
# The compiler's stdout is the caller's: `--json` puts the diagnostics there
# and nothing else does. Its `wrote <file>` lines go to stderr, where stage0
# puts them — but they name the directory this script compiled into, which for
# a `-o <file.ll>` or a single-module `--link` is not where the file ends up.
# So stderr is buffered and the lines that would name the wrong path are
# replaced below with the one the file really has.
compiler_err=$(mktemp)
"$compiler" "${entries[@]}" "${flags[@]+"${flags[@]}"}" --out-dir "$dir" 2>"$compiler_err"
status=$?
if [ "$status" -ne 0 ]; then
  cat "$compiler_err" >&2
  rm -f "$compiler_err"
  [ -n "$scratch" ] && rm -rf "$scratch"
  exit "$status"
fi

modules=("$dir"/*.ll)
# Whether the `wrote` lines the compiler already printed name the files that
# will still be there when this script returns.
keep_chatter=1
if [ -n "$single" ]; then
  # stage0 refuses this layout rather than picking a module, and says so with
  # the names; mirror both the wording and its exit code.
  if [ "${#modules[@]}" -ne 1 ]; then
    echo "amritc.sh: ${#modules[@]} modules would be written; pass \`-o <dir>/\` to write one .ll per module" >&2
    rm -f "$compiler_err"
    rm -rf "$scratch"
    exit 1
  fi
  mv "${modules[0]}" "$single"
  rmdir "$scratch"
  keep_chatter=0
  echo "wrote $single" >&2
fi

if [ -n "$link" ] && [ "${#modules[@]}" -eq 1 ] && [ -z "$single" ]; then
  keep_chatter=0
fi
if [ "$keep_chatter" -eq 1 ]; then
  cat "$compiler_err" >&2
fi
rm -f "$compiler_err"

[ -n "$link" ] || exit 0

# stage0 writes a single-module program's IR as `<exe>.ll` rather than a
# directory of one; mirror that, so the two compilers leave the same files.
if [ "${#modules[@]}" -eq 1 ]; then
  mv "${modules[0]}" "$link.ll"
  rmdir "$dir"
  modules=("$link.ll")
  echo "wrote $link.ll" >&2
fi

# stage0 refuses `--link` on a program with no entry point before it emits
# anything, with the message and the exit code below; without this the link
# reaches clang, which fails at `undefined reference to main` and exit 3.
if ! grep -q '^define [^@]*@main(' "${modules[@]}"; then
  echo "amritc.sh: --link: the entry module $entry must declare \`export function main(): number\` (or \`: void\`)" >&2
  # stage0 refuses before it emits, so it leaves nothing behind; this can only
  # know after the emit, so it takes the IR back out again.
  rm -f "${modules[@]}"
  rmdir "$dir" 2>/dev/null
  exit 1
fi

# `-g` reaches the linker too: runtime.c is compiled with debug info and the
# profile's strip step is skipped, so the DWARF stage1 emitted survives.
link_flags=()
if [ "$debug" = 1 ]; then link_flags+=(-g); fi
if ! bash scripts/build.sh "${modules[@]}" runtime/runtime.c -o "$link" --profile "$profile" \
  "${link_flags[@]+"${link_flags[@]}"}"; then
  echo "amritc.sh: --link: scripts/build.sh failed; the IR is in ${modules[*]}" >&2
  exit 3
fi
