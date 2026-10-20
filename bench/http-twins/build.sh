#!/usr/bin/env bash
# Builds the cross-runtime twins of bench/http1-server.ts, each into
# build/http-twins/<name>/ with an executable `serve <port> [ignored...]`.
#
#   bash bench/http-twins/build.sh                  every twin
#   bash bench/http-twins/build.sh go-nethttp nginx  only these
#
# Every toolchain is pinned below and checked before it is used; a different
# version is an error, not a warning, because the numbers are only comparable
# between pinned builds. NODE and BUN name an interpreter other than the one on
# PATH. Nothing is written inside bench/http-twins: the Rust twins are built
# from a staging copy, because the repository's file-name rule keeps
# `Cargo.toml` and `Cargo.lock` as `cargo.toml` and `cargo.lock`.
#
# TWINS_RELOCK=1 regenerates the Rust twins' cargo.lock with cargo, and the Bun
# framework twins' bun.lock with bun, and copies them back into the tree;
# without it the committed lock is used with --locked or --frozen-lockfile.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
out="$root/build/http-twins"
stage="$out/.stage"

NODE_VERSION=26.12.0
BUN_VERSION=1.4.3
UWS_TAG=v20.71.0
UWS_COMMIT=9ec36de7709996c58dce03d63796216c90a17136
GO_VERSION=go1.27.2
RUST_VERSION=1.99.1
NGINX_VERSION=1.30.6
NGINX_SHA256=3cf46f5ed7504d460125866b7bea99fb357f31d887e2e63b35503310e9b8b6c8

ALL=(node-http uws bun bun-elysia bun-hono go-nethttp go-fasthttp rust-hyper rust-actix nginx)

die() {
  echo "build.sh: $*" >&2
  exit 1
}

# The interpreter in $1 (or $2 on PATH), refused unless `--version` prints $3.
pinned() {
  local bin=${1:-$(command -v "$2" || true)}
  [ -n "$bin" ] || die "$2 is not installed (README.md has the install steps)"
  local got
  got=$("$bin" --version)
  [ "${got#v}" = "$3" ] || die "$bin is $got, the twins pin $2 $3"
  echo "$bin"
}

# A serve script that runs server.mjs, copied with extra-routes.mjs beside it,
# under the interpreter $2.
# It drops NODE_OPTIONS and BUN_OPTIONS, so a flag in the caller's environment
# (such as Bun's --smol) cannot change the runtime being measured.
script_twin() {
  local name=$1 interpreter=$2
  mkdir -p "$out/$name"
  cp "$here/$name/server.mjs" "$here/extra-routes.mjs" "$out/$name/"
  printf '#!/bin/sh\nunset NODE_OPTIONS BUN_OPTIONS\nexec %s %s "$@"\n' "$interpreter" "$out/$name/server.mjs" >"$out/$name/serve"
  chmod +x "$out/$name/serve"
}

# The interpreter is assigned before use: a `die` inside a `$(...)` passed as an
# argument would not stop the build under `set -e`.
build_node_http() {
  local node
  node=$(pinned "${NODE:-}" node "$NODE_VERSION")
  script_twin node-http "$node"
}

# uWebSockets.js is not on npm; its GitHub tag carries the prebuilt addons. The
# tag is cloned once into the staging directory and refused unless it is the
# pinned commit.
build_uws() {
  local node
  node=$(pinned "${NODE:-}" node "$NODE_VERSION")
  local src="$stage/uws-$UWS_TAG"
  if [ ! -d "$src" ]; then
    git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$UWS_TAG" https://github.com/uNetworking/uWebSockets.js.git "$src.tmp"
    mv "$src.tmp" "$src"
  fi
  [ "$(git -C "$src" rev-parse HEAD)" = "$UWS_COMMIT" ] || die "uWebSockets.js $UWS_TAG is not commit $UWS_COMMIT"
  local abi
  abi=$("$node" -p process.versions.modules)
  local addon="uws_linux_x64_$abi.node"
  [ -f "$src/$addon" ] || die "uWebSockets.js $UWS_TAG has no $addon for node $NODE_VERSION"
  local pkg="$out/uws/node_modules/uWebSockets.js"
  rm -rf "$pkg"
  mkdir -p "$pkg"
  cp "$src/package.json" "$src/uws.js" "$src/LICENSE" "$src/$addon" "$pkg/"
  script_twin uws "$node"
}

build_bun() {
  local bun
  bun=$(pinned "${BUN:-}" bun "$BUN_VERSION")
  script_twin bun "$bun"
}

# A framework on Bun (Elysia, Hono): its package.json and bun.lock are copied
# beside server.mjs and installed there, so nothing lands in bench/http-twins.
build_bun_framework() {
  local name=$1 bun
  bun=$(pinned "${BUN:-}" bun "$BUN_VERSION")
  script_twin "$name" "$bun"
  local dir="$out/$name"
  cp "$here/$name/package.json" "$dir/package.json"
  if [ "${TWINS_RELOCK:-}" = 1 ]; then
    (cd "$dir" && rm -f bun.lock && "$bun" install --silent)
    cp "$dir/bun.lock" "$here/$name/bun.lock"
  fi
  cp "$here/$name/bun.lock" "$dir/bun.lock"
  (cd "$dir" && "$bun" install --silent --frozen-lockfile --production)
}

# go.mod's `toolchain` line makes `go` fetch the pinned release when the
# installed one is older (GOTOOLCHAIN=auto, the default).
build_go() {
  local name=$1
  local got
  got=$(cd "$here/$name" && go env GOVERSION)
  [ "$got" = "$GO_VERSION" ] || die "$name builds with $got, the twins pin $GO_VERSION"
  mkdir -p "$out/$name"
  (cd "$here/$name" && go build -trimpath -o "$out/$name/serve" .)
}

build_rust() {
  local name=$1
  local dir="$stage/$name"
  rm -rf "$dir/src"
  mkdir -p "$dir"
  cp -r "$here/$name/src" "$dir/src"
  cp "$here/rust-extra.rs" "$dir/src/extra.rs"
  cp "$here/$name/cargo.toml" "$dir/Cargo.toml"
  cp "$here/rust-toolchain.toml" "$dir/rust-toolchain.toml"
  if command -v rustup >/dev/null; then
    rustup toolchain install "$RUST_VERSION" --profile minimal >/dev/null || die "rustup could not install Rust $RUST_VERSION"
  fi
  local got
  got=$(cd "$dir" && rustc --version)
  case "$got" in
    "rustc $RUST_VERSION "*) ;;
    *) die "$name builds with $got, the twins pin rustc $RUST_VERSION" ;;
  esac
  if [ "${TWINS_RELOCK:-}" = 1 ]; then
    (cd "$dir" && rm -f Cargo.lock && cargo generate-lockfile --quiet)
    cp "$dir/Cargo.lock" "$here/$name/cargo.lock"
  fi
  cp "$here/$name/cargo.lock" "$dir/Cargo.lock"
  (cd "$dir" && cargo build --quiet --release --locked)
  mkdir -p "$out/$name"
  cp "$dir/target/release/serve" "$out/$name/serve"
}

# nginx stable from its release tarball, checked against the pinned sha256, with
# only what `return` needs: the rewrite module (and so PCRE2), no gzip.
build_nginx() {
  local dest="$out/nginx"
  if [ "$("$dest/sbin/nginx" -v 2>&1 || true)" != "nginx version: nginx/$NGINX_VERSION" ]; then
    local tarball="$stage/nginx-$NGINX_VERSION.tar.gz"
    mkdir -p "$stage"
    if [ ! -f "$tarball" ]; then
      curl -fsSL "https://nginx.org/download/nginx-$NGINX_VERSION.tar.gz" -o "$tarball.tmp"
      mv "$tarball.tmp" "$tarball"
    fi
    echo "$NGINX_SHA256  $tarball" | sha256sum --check --quiet || die "nginx-$NGINX_VERSION.tar.gz is not the pinned tarball"
    rm -rf "$stage/nginx-$NGINX_VERSION"
    tar -xzf "$tarball" -C "$stage"
    (
      cd "$stage/nginx-$NGINX_VERSION"
      ./configure --prefix="$dest" --without-http_gzip_module >/dev/null
      make --silent -j"$(nproc)" >/dev/null
      make --silent install >/dev/null
    )
  fi
  cp "$here/nginx/nginx.conf" "$dest/nginx.conf"
  "${NODE:-node}" "$here/nginx/extra-conf.mjs" >"$dest/extra.conf"
  cp "$here/nginx/serve" "$dest/serve"
  chmod +x "$dest/serve"
}

build() {
  case "$1" in
    node-http) build_node_http ;;
    uws) build_uws ;;
    bun) build_bun ;;
    bun-elysia | bun-hono) build_bun_framework "$1" ;;
    go-nethttp | go-fasthttp) build_go "$1" ;;
    rust-hyper | rust-actix) build_rust "$1" ;;
    nginx) build_nginx ;;
    *) die "no twin named $1 (one of: ${ALL[*]})" ;;
  esac
}

names=("$@")
[ ${#names[@]} -gt 0 ] || names=("${ALL[@]}")
for name in "${names[@]}"; do
  echo "build.sh: $name"
  build "$name"
done
