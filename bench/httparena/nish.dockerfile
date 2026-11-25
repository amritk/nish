# The HttpArena image of the Nish entry. HttpArena builds
# frameworks/nish/Dockerfile, so this file is copied there under that name (the
# repository's file-name lint keeps it lower-case here). HttpArena runs its CMD
# with no arguments under --network host, with the dataset mounted at
# /data/dataset.json and Postgres named by DATABASE_URL. It installs a released
# compiler with install.sh, which checks the download's SHA-256 before
# unpacking it, and LLVM 18 for the link. install.sh is fetched from the
# release's own tag, not from `main`.
FROM ubuntu:24.04

# A failed download fails the build rather than piping nothing into sh.
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG NISH_VERSION=0.46.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl clang-18 lld-18 llvm-18 \
 && rm -rf /var/lib/apt/lists/*

ENV CC=clang-18 \
    NISH_INSTALL=/opt/nish \
    PATH=/opt/nish/bin:/usr/lib/llvm-18/bin:$PATH

RUN curl -fsSL https://raw.githubusercontent.com/amritk/nish/v${NISH_VERSION}/install.sh | sh -s -- "$NISH_VERSION"

WORKDIR /nish
COPY main.ts server.ts db.ts ./
# A bench program, built as bench/techempower/run.sh builds one: the std
# server's constructors keep their limit panics, so the package is held to the
# noPanic list only.
# strict: the image has a release from install.sh and no scripts/nish-compiler.sh, so it passes the flag itself
RUN nish --allow-panics main.ts --link entry --profile speed

EXPOSE 8080 8082

# HTTP/1.1 on 8080, h2c on 8082, every interface, 16384 slots a worker, one
# worker a core, the mounted dataset.
CMD ["./entry", "8080", "8082", "0.0.0.0", "16384", "0", "/data/dataset.json"]
