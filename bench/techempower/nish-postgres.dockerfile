# The TechEmpower image of the Nish database entry, for the test named
# `postgres`: TFB builds frameworks/Nish/nish/nish-postgres.dockerfile and
# expects the server on port 8080, with the database at the host
# `tfb-database` (user benchmarkdbuser, database hello_world). It installs a
# released compiler as nish.dockerfile does. NISH_VERSION must name 0.30.0 or
# later, the first release with nish/net/handler, PgCarrier and
# nish/net/prefork.
FROM ubuntu:24.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG NISH_VERSION=0.30.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl clang-18 lld-18 llvm-18 \
 && rm -rf /var/lib/apt/lists/*

ENV CC=clang-18 \
    NISH_INSTALL=/opt/nish \
    PATH=/opt/nish/bin:/usr/lib/llvm-18/bin:$PATH

RUN curl -fsSL https://raw.githubusercontent.com/amritk/nish/v${NISH_VERSION}/install.sh | sh -s -- "$NISH_VERSION"

WORKDIR /nish
COPY db-main.ts db-server.ts ./
RUN nish db-main.ts --link db-entry --profile speed

EXPOSE 8080

# The carrier connects to a numeric address only, so the database's name is
# resolved here, once, at start; an empty answer stops the container with a
# message rather than starting a server with no database. One worker a core,
# 4 connections each.
CMD ["sh", "-c", "db=$(getent ahostsv4 tfb-database | awk 'NR==1 {print $1}'); if [ -z \"$db\" ]; then echo 'nish-postgres: tfb-database does not resolve' >&2; exit 1; fi; exec ./db-entry 5432 benchmarkdbuser benchmarkdbpass hello_world 8080 0.0.0.0 \"$db\" 0 4"]
