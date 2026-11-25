#!/bin/sh
# Fetch the graphics libraries runtime/gfx/ links against: wgpu-native and
# SDL3, at the versions docs/wp89-gfx.md pins, into build/gfx/<platform>/.
#
#   scripts/fetch-gfx.sh            fetch them, unless build/gfx/<platform>/ has them
#   scripts/fetch-gfx.sh --force    fetch and build them again, whatever is there
#
# Each download is checked against its pinned sha256 before anything reads
# it, and a mismatch stops the script with nothing installed. wgpu-native
# ships a static libwgpu_native.a per platform. SDL publishes no Linux
# binary, and its macOS asset is a dynamic framework, so SDL3 is built here
# from the source tarball with SDL's own CMake and ninja, as a static
# libSDL3.a with the Wayland, X11 and offscreen video drivers on Linux and the
# Cocoa and offscreen ones on macOS. The Wayland and X11 client libraries are
# opened at run time, not linked, so a binary that draws offscreen needs
# neither (SDL's default for both).
#
# The result is build/gfx/<platform>/{include,lib}, the layout
# scripts/build.sh reads. NISH_GFX_PREFIX names an install made another way
# (a distro SDL 3.4 and a wgpu-native beside it): with it set, scripts/build.sh
# reads that prefix and this script has nothing to do, so it says so and stops.
#
# The libraries' notices, which a binary that links them carries, are listed
# in runtime/gfx/README.md.
set -eu

cd "$(dirname "$0")/.."

force=""
while [ $# -gt 0 ]; do
  case "$1" in
    -h | --help) sed -n '2,/^set -eu$/{/^set -eu$/d;s/^# \{0,1\}//;p}' "$0"; exit 0 ;;
    --force) force=1; shift ;;
    *) printf 'fetch-gfx: unknown argument %s (try --help)\n' "$1" >&2; exit 2 ;;
  esac
done

if [ -n "${NISH_GFX_PREFIX:-}" ]; then
  printf 'fetch-gfx: NISH_GFX_PREFIX is set (%s); scripts/build.sh reads it, so there is nothing to fetch\n' "$NISH_GFX_PREFIX"
  exit 0
fi

wgpu_version=v29.0.1.1
wgpu_base="https://github.com/gfx-rs/wgpu-native/releases/download/$wgpu_version"
sdl_version=3.4.20
sdl_base="https://github.com/libsdl-org/SDL/releases/download/release-$sdl_version"
sdl_tarball="SDL3-$sdl_version.tar.gz"
sdl_sha256=f3bb06f55bed9557227a700af2ea62e49497ebdf58037732a731a5fb3ef8581f

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)
    platform=linux-x86_64
    wgpu_zip=wgpu-linux-x86_64-release.zip
    wgpu_sha256=95a4d90c071005a98d03eab348beaa6b07e16eb00d1dcdb9f8348f75eb97ec5a ;;
  Linux-aarch64 | Linux-arm64)
    platform=linux-aarch64
    wgpu_zip=wgpu-linux-aarch64-release.zip
    wgpu_sha256=015fcdf1dbae82e614a783cc38017e5399ae0927a889fe9b69c9b664bc61b47a ;;
  Darwin-x86_64)
    platform=macos-x86_64
    wgpu_zip=wgpu-macos-x86_64-release.zip
    wgpu_sha256=8e2f7378548ddd0e2cf21e7d864dda46e953f0af724855a33778b85ead206d41 ;;
  Darwin-arm64)
    platform=macos-aarch64
    wgpu_zip=wgpu-macos-aarch64-release.zip
    wgpu_sha256=a5797a37b1adf720bcd5dcffb291edbbd5b7b14be0a3874c28e6393a655a7a3e ;;
  *) printf 'fetch-gfx: no pinned wgpu-native for %s-%s\n' "$(uname -s)" "$(uname -m)" >&2; exit 2 ;;
esac

dest="build/gfx/$platform"
stamp="$dest/.fetched"
want="wgpu-native $wgpu_version, SDL $sdl_version"
# An install is there when its stamp names these versions and every file
# scripts/build.sh requires under a prefix is present; anything less is fetched
# again.
installed() {
  [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$want" ] || return 1
  for f in include/SDL3/SDL.h include/webgpu/webgpu.h include/webgpu/wgpu.h \
           lib/libSDL3.a lib/libwgpu_native.a; do
    [ -f "$dest/$f" ] || return 1
  done
}
if [ -z "$force" ] && installed; then
  printf 'fetch-gfx: %s in %s (already there)\n' "$want" "$dest"
  exit 0
fi

for tool in curl unzip tar cmake ninja; do
  command -v "$tool" >/dev/null 2>&1 || { printf 'fetch-gfx: %s is not on PATH\n' "$tool" >&2; exit 2; }
done

# sha256 of a file: sha256sum on Linux, shasum on macOS.
sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# fetch <url> <file> <sha256>: download, then refuse a file whose digest is not the pin.
fetch() {
  printf 'fetch-gfx: %s\n' "$1"
  curl --proto '=https' --proto-redir '=https' --tlsv1.2 -fsSL --retry 3 -o "$2" "$1"
  got="$(sha256 "$2")"
  if [ "$got" != "$3" ]; then
    printf 'fetch-gfx: %s has sha256 %s, not the pinned %s\n' "$1" "$got" "$3" >&2
    exit 1
  fi
}

# The work directory is inside build/gfx/, so the last step's mv is a rename
# on one filesystem, never a copy an interrupt can stop halfway. Its name
# starts with a dot, which the run cache's stamp scan skips.
mkdir -p build/gfx
work="$(mktemp -d build/gfx/.fetch-gfx.XXXXXX)"
trap 'rm -rf "$work"' EXIT

fetch "$wgpu_base/$wgpu_zip" "$work/wgpu.zip" "$wgpu_sha256"
fetch "$sdl_base/$sdl_tarball" "$work/sdl.tar.gz" "$sdl_sha256"

# Everything is built into a staging prefix and renamed into place last, so a
# failed build leaves the previous install, or none, never half of one. The
# previous install is renamed aside into $work, which the EXIT trap removes,
# rather than deleted in place, and the stamp is written only after the new
# one is renamed in: an interrupt leaves the old install with its stamp,
# nothing, or the new install without a stamp, which the next run fetches
# again.
stage="$work/prefix"
mkdir -p "$stage/include/webgpu" "$stage/lib" "$work/wgpu"
unzip -q "$work/wgpu.zip" -d "$work/wgpu"
cp "$work/wgpu/include/webgpu/webgpu.h" "$work/wgpu/include/webgpu/wgpu.h" "$stage/include/webgpu/"
cp "$work/wgpu/lib/libwgpu_native.a" "$stage/lib/"

tar -xzf "$work/sdl.tar.gz" -C "$work"
case "$platform" in
  linux-*) drivers="-DSDL_WAYLAND=ON -DSDL_X11=ON -DSDL_OFFSCREEN=ON" ;;
  macos-*) drivers="-DSDL_COCOA=ON -DSDL_OFFSCREEN=ON" ;;
esac
# Only video and events are used: audio, camera, haptics, joysticks, sensors,
# SDL's own GPU API and its tests are left out, so the library is smaller and
# opens no device the shim never asked for. $drivers is split on purpose.
# shellcheck disable=SC2086
cmake -S "$work/SDL3-$sdl_version" -B "$work/sdl-build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$stage" \
  -DCMAKE_INSTALL_LIBDIR=lib -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
  -DSDL_STATIC=ON -DSDL_SHARED=OFF -DSDL_TEST_LIBRARY=OFF -DSDL_TESTS=OFF -DSDL_EXAMPLES=OFF \
  -DSDL_AUDIO=OFF -DSDL_CAMERA=OFF -DSDL_HAPTIC=OFF -DSDL_JOYSTICK=OFF -DSDL_HIDAPI=OFF \
  -DSDL_SENSOR=OFF -DSDL_POWER=OFF -DSDL_GPU=OFF -DSDL_RENDER=OFF -DSDL_DIALOG=OFF \
  $drivers >"$work/cmake.log" 2>&1 || { cat "$work/cmake.log" >&2; exit 1; }
cmake --build "$work/sdl-build" >"$work/build.log" 2>&1 || { cat "$work/build.log" >&2; exit 1; }
cmake --install "$work/sdl-build" >/dev/null

if [ -e "$dest" ]; then mv "$dest" "$work/old"; fi
mv "$stage" "$dest"
printf '%s\n' "$want" > "$stamp"
printf 'fetch-gfx: %s in %s\n' "$want" "$dest"
