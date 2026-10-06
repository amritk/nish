# The Nish interop server as a quic-interop-runner server endpoint.
#
#   docker build -f tests/interop/server.dockerfile -t nish-interop .
#
# The context is the repository. The first stage builds Nish from the
# checkout: the last release (the seed, which `scripts/fetch-seed.sh` checks
# against its published SHA-256) builds the compiler in `src/` with LLVM 18,
# and that compiler builds the server, `tests/link/net_interop_server`, with
# this checkout's `std/`. The second stage is the runner's endpoint image,
# whose `setup.sh` routes through the network simulator, with the server and
# `run-endpoint.sh` added. Every base image is pinned by digest.
FROM ubuntu:24.04@sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55 AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl clang-18 lld-18 llvm-18 \
 && rm -rf /var/lib/apt/lists/* \
 && for tool in clang llc llvm-as opt ld.lld wasm-ld lld; do ln -s "/usr/bin/$tool-18" "/usr/local/bin/$tool"; done
WORKDIR /nish
COPY install.sh package.json ./
COPY scripts/ scripts/
RUN version="$(sed -n 's/^  "version": "\(.*\)",$/\1/p' package.json)" \
 && sh scripts/fetch-seed.sh "$version"
COPY src/ src/
COPY std/ std/
COPY runtime/ runtime/
RUN build/seed/bin/nish src/compile.ts --link build/nish
COPY tests/link/ tests/link/
RUN build/nish tests/link/net_interop_server/main.ts -o build/interop/ --link build/interop-server

FROM martenseemann/quic-network-simulator-endpoint@sha256:3b2b9e6fa317da238c8140a7b6d2bf8d4d45a8464b873eecac3ff2a32520b71a
COPY --from=build /nish/build/interop-server /interop-server
COPY tests/interop/run-endpoint.sh /run_endpoint.sh
RUN chmod +x /run_endpoint.sh
ENTRYPOINT ["/run_endpoint.sh"]
