# The TechEmpower image of the Nish entry, in the upstream layout: TFB builds
# frameworks/Nish/nish/nish.dockerfile for the test named `default` and expects
# the server on port 8080. It installs a released compiler with install.sh,
# which checks the download's SHA-256 before unpacking it, and LLVM 18 for the
# link. install.sh is fetched from the release's own tag, not from `main`.
# NISH_VERSION must name a release after 0.18.0: 0.18.0 has neither
# `tcpListenFlags` nor `JsonWriter`, which the entry uses, so the image builds
# only once 0.19.0 is released.
FROM ubuntu:24.04

# A failed download fails the build rather than piping nothing into sh.
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG NISH_VERSION=0.19.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl clang-18 lld-18 llvm-18 \
 && rm -rf /var/lib/apt/lists/*

ENV CC=clang-18 \
    NISH_INSTALL=/opt/nish \
    PATH=/opt/nish/bin:/usr/lib/llvm-18/bin:$PATH

RUN curl -fsSL https://raw.githubusercontent.com/amritk/nish/v${NISH_VERSION}/install.sh | sh -s -- "$NISH_VERSION"

WORKDIR /nish
COPY main.ts server.ts ./
RUN nish main.ts --link entry --profile speed

EXPOSE 8080

# Port 8080, TCP_NODELAY asked for, every interface, 16384 slots.
CMD ["./entry", "8080", "1", "0.0.0.0", "16384"]
