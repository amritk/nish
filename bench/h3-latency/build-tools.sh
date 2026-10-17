#!/usr/bin/env bash
# Builds the HTTP/3 client and reference server that bench/h3-latency.mjs drives:
# h2load (nghttp2) with HTTP/3, over ngtcp2 and nghttp3, and nginx with
# http_v3, all against one OpenSSL that speaks the QUIC TLS API. Nothing here
# is a dependency of nish; it is a measuring instrument, kept out of the tree.
#
#   bash bench/h3-latency/build-tools.sh [--prefix <dir>]
#
# The prefix defaults to ~/.cache/nish-h3-bench. A component already installed
# at its pinned version is skipped, so a second run costs nothing. Each tarball
# is checked against the SHA-256 below before it is unpacked.
#
# nghttp2 1.70 needs C++23's <print>, which GCC 13 lacks, so h2load is built
# with gcc-14 / g++-14, and h2load links libev and c-ares (Ubuntu 24.04:
# apt-get update, then apt-get install -y gcc-14 g++-14 libev-dev libc-ares-dev
# zlib1g-dev).
set -euo pipefail

prefix="${HOME}/.cache/nish-h3-bench"
while [ $# -gt 0 ]; do
  case "$1" in
    --prefix)
      prefix="$2"
      shift 2
      ;;
    -h | --help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "build-tools.sh: unknown argument '$1'" >&2
      exit 2
      ;;
  esac
done

openssl_ver=3.6.5
openssl_url="https://github.com/openssl/openssl/releases/download/openssl-${openssl_ver}/openssl-${openssl_ver}.tar.gz"
openssl_sha=a2157c2830efdec3788939b00c9b0638306d3f0bbb76dc4832ee503bb397df98
nghttp3_ver=1.18.0
nghttp3_url="https://github.com/ngtcp2/nghttp3/releases/download/v${nghttp3_ver}/nghttp3-${nghttp3_ver}.tar.xz"
nghttp3_sha=aad782c23d3f01bd4bb52c8bac7a553b631ef8115fd1612703df6183449fef19
ngtcp2_ver=1.25.0
ngtcp2_url="https://github.com/ngtcp2/ngtcp2/releases/download/v${ngtcp2_ver}/ngtcp2-${ngtcp2_ver}.tar.xz"
ngtcp2_sha=2a34d2484ba17847a5d11965704e9dd0fac4c6d8efc75ffe1ec7de66d8c6b6fb
nghttp2_ver=1.70.0
nghttp2_url="https://github.com/nghttp2/nghttp2/releases/download/v${nghttp2_ver}/nghttp2-${nghttp2_ver}.tar.xz"
nghttp2_sha=e05cb1388eaca3830aded4ccf20044b6e1ac1a61411dcca11b0437c4285c8bc2
nginx_ver=1.31.7
nginx_url="https://nginx.org/download/nginx-${nginx_ver}.tar.gz"
nginx_sha=89ea8a3dc171511f7325043b50e4c036248d9fad5feb7ec809c0b82d5df42c65

for tool in gcc-14 g++-14 make curl sha256sum tar pkg-config; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "build-tools.sh: '$tool' is not on PATH (gcc-14 / g++-14: apt-get install -y gcc-14 g++-14)" >&2
    exit 2
  fi
done
for header in ev.h ares.h zlib.h; do
  if ! echo "#include <${header}>" | gcc-14 -E - >/dev/null 2>&1; then
    echo "build-tools.sh: <${header}> not found (apt-get install -y libev-dev libc-ares-dev zlib1g-dev)" >&2
    exit 2
  fi
done

jobs="$(nproc)"
src="${prefix}/src"
stamps="${prefix}/stamps"
mkdir -p "$src" "$stamps"

# A stamp per component names the version it holds; a rebuild happens only
# when the pinned version moves or the stamp is gone.
installed() {
  [ -f "${stamps}/$1" ] && [ "$(cat "${stamps}/$1")" = "$2" ]
}

# Downloads, verifies and unpacks one tarball into ${src}, and prints the
# directory it unpacked to.
fetch() {
  local url="$1" sha="$2" file
  file="${src}/$(basename "$url")"
  if [ ! -f "$file" ] || ! echo "${sha}  ${file}" | sha256sum -c --quiet - >/dev/null 2>&1; then
    curl -fsSL -o "$file" "$url"
  fi
  if ! echo "${sha}  ${file}" | sha256sum -c --quiet -; then
    echo "build-tools.sh: checksum mismatch for $url" >&2
    exit 1
  fi
  local dir="${file%.tar.*}"
  rm -rf "$dir"
  tar -xf "$file" -C "$src"
  echo "$dir"
}

export PKG_CONFIG_PATH="${prefix}/lib/pkgconfig"
export LD_LIBRARY_PATH="${prefix}/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"

if ! installed openssl "$openssl_ver"; then
  echo "== OpenSSL ${openssl_ver}"
  dir="$(fetch "$openssl_url" "$openssl_sha")"
  (cd "$dir" && ./Configure --prefix="$prefix" --libdir=lib no-docs no-tests \
    "-Wl,-rpath,${prefix}/lib" >/dev/null && make -j"$jobs" >/dev/null &&
    make install_sw install_ssldirs >/dev/null)
  echo "$openssl_ver" >"${stamps}/openssl"
fi

for lib in nghttp3 ngtcp2; do
  ver_var="${lib}_ver"
  url_var="${lib}_url"
  sha_var="${lib}_sha"
  if ! installed "$lib" "${!ver_var}"; then
    echo "== ${lib} ${!ver_var}"
    dir="$(fetch "${!url_var}" "${!sha_var}")"
    (cd "$dir" && ./configure --prefix="$prefix" --enable-lib-only --with-openssl \
      LDFLAGS="-Wl,-rpath,${prefix}/lib" >/dev/null && make -j"$jobs" >/dev/null && make install >/dev/null)
    echo "${!ver_var}" >"${stamps}/${lib}"
  fi
done

if ! installed nghttp2 "$nghttp2_ver"; then
  echo "== nghttp2 ${nghttp2_ver} (h2load with HTTP/3)"
  dir="$(fetch "$nghttp2_url" "$nghttp2_sha")"
  (cd "$dir" && CC=gcc-14 CXX=g++-14 ./configure --prefix="$prefix" --enable-http3 --enable-app \
    --with-libngtcp2 --with-libnghttp3 \
    LDFLAGS="-Wl,-rpath,${prefix}/lib" >/dev/null && make -j"$jobs" >/dev/null && make install >/dev/null)
  echo "$nghttp2_ver" >"${stamps}/nghttp2"
fi

if ! installed nginx "$nginx_ver"; then
  echo "== nginx ${nginx_ver} (http_v3)"
  dir="$(fetch "$nginx_url" "$nginx_sha")"
  (cd "$dir" && ./configure --prefix="${prefix}/nginx" --with-http_v3_module --with-http_ssl_module \
    --without-http_rewrite_module --without-http_gzip_module \
    --with-cc-opt="-I${prefix}/include" --with-ld-opt="-L${prefix}/lib -Wl,-rpath,${prefix}/lib" >/dev/null &&
    make -j"$jobs" >/dev/null && make install >/dev/null)
  echo "$nginx_ver" >"${stamps}/nginx"
fi

# h2load prints no HTTP/3 line in --version, and its help lists --h3 either
# way, so the check is that it links ngtcp2, which only an HTTP/3 build does;
# nginx's is its configure arguments.
"${prefix}/bin/h2load" --version
if ! ldd "${prefix}/bin/h2load" | grep -q "libngtcp2"; then
  echo "build-tools.sh: ${prefix}/bin/h2load was built without HTTP/3" >&2
  exit 1
fi
"${prefix}/nginx/sbin/nginx" -V 2>&1 | head -1
if ! "${prefix}/nginx/sbin/nginx" -V 2>&1 | grep -q -- "--with-http_v3_module"; then
  echo "build-tools.sh: ${prefix}/nginx/sbin/nginx was built without http_v3" >&2
  exit 1
fi
echo "tools in ${prefix}: bin/h2load, nginx/sbin/nginx"
