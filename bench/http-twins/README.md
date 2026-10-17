# The HTTP twins

Eight servers that answer exactly what the Nish HTTP/1.1 server
(`bench/http1-server.ts`) answers, built on other runtimes so that
`bench/http.mjs` can time them side by side. Each is held to one core: one
process, one event loop or one worker, and `bench/http.mjs` pins it to CPU 0
with `taskset` as it pins the Nish server.

```bash
bash bench/http-twins/build.sh      # every twin, into build/http-twins/<name>/
node bench/http-twins/check.mjs     # every built twin answers the Nish server's bytes
bash bench/http-twins/run.sh        # nish, nish-copy and every twin, under wrk
```

## The contract

Every twin is an executable `build/http-twins/<name>/serve <port> [ignored...]`.
It binds 127.0.0.1:`<port>`, prints `listening <port>` once bound and exits on
SIGINT. `serve` is the measured process itself (a binary, or a script that
`exec`s one), so the pid `bench/http.mjs` reads CPU time and RSS from is the
server's.

| Request | Answer |
| --- | --- |
| `GET /plaintext` | 200, `text/plain`, `Hello, World!` |
| `GET /json` | 200, `application/json`, `{"message":"Hello, World!","n":<n>}`, where `n` counts the requests this process has answered, this one included |
| `POST /json-echo` with `bench/http-payload.json` | 200, `application/json`, the payload with `"revision":7` made `"revision":8` |
| anything else, `/json-echo-doc` included | 404 |

The echo decodes the body into a typed order (with `notes` a nullable string),
increments `revision` and encodes it again compactly, keeping the key order
and printing every number in its shortest round-trip form. No twin splices
bytes. The JavaScript twins are the exception to "typed": they decode with
`JSON.parse` into a plain object and encode with `JSON.stringify`, which is
what a JavaScript server does and gives the same bytes.

nginx is the other exception. It answers from `return` alone, so it has no
echo: `/json-echo` is a 404 and its cell reads n/a. Its `n` is
`$connection_requests`, which counts per connection, not per process, because
nginx keeps no counter shared between connections.

## The twins and their versions

Every version is pinned exactly: `build.sh` refuses a toolchain that is not the
pinned one, and the dependencies are locked by their own tools (`go.sum`,
`cargo.lock`). The versions were the latest stable releases on 2026-10-16.

| Twin | What it is | Versions |
| --- | --- | --- |
| `node-http` | `node:http` `createServer`, one process, no cluster | Node 26.12.0 |
| `uws` | uWebSockets.js `App`, one process | uWebSockets.js v20.71.0 (commit `9ec36de7`), Node 26.12.0 |
| `bun` | `Bun.serve` with `routes`, one process, no `reusePort` | Bun 1.4.3 |
| `go-nethttp` | `net/http` with `encoding/json`, `GOMAXPROCS=1` | Go 1.27.2 |
| `go-fasthttp` | fasthttp with `encoding/json`, `GOMAXPROCS=1` | Go 1.27.2, fasthttp v1.75.0 |
| `rust-hyper` | hyper 1 `http1` on a tokio current-thread runtime, serde_json | Rust 1.99.1, hyper 1.12.0, hyper-util 0.1.21, tokio 1.53.3, serde 1.0.229, serde_json 1.0.154 |
| `rust-actix` | actix-web 4 with `workers(1)`, serde_json | Rust 1.99.1, actix-web 4.17.0, serde 1.0.229, serde_json 1.0.154 |
| `nginx` | `return`, `worker_processes 1`, `master_process off`, `daemon off` | nginx 1.30.6 (stable) |

Where each pin lives:

- Node, Bun, uWebSockets.js and nginx: the variables at the top of `build.sh`.
- Go: the `toolchain` line in each `go.mod`.
- Rust: `rust-toolchain.toml`.

uWebSockets.js is not published to npm. `build.sh` clones its tag, checks the
commit, and copies the addon for Node 26 (ABI 147) into
`build/http-twins/uws/node_modules`. nginx is built from its release tarball,
checked against a pinned sha256, with the gzip module left out.

The repository's file names are kebab-case, so the Rust manifests are
committed as `cargo.toml` and `cargo.lock`. `build.sh` copies them, with
`src/` and `rust-toolchain.toml`, into `build/http-twins/.stage/<name>/` under
Cargo's names and builds there with `--locked`. To move a Rust pin, edit
`cargo.toml` and run `TWINS_RELOCK=1 bash bench/http-twins/build.sh rust-hyper
rust-actix`, which writes `cargo.lock` back with `cargo generate-lockfile`.
To move a Go pin, run `go get` and `go mod tidy` in the twin's directory.

## Installing the toolchains on Ubuntu

`build.sh` needs the toolchains of the twins it builds; `run.sh` also needs wrk.
`NODE=` and `BUN=` name an interpreter other than the one on `PATH`.

```bash
# wrk (the load generator), taskset, git, a C compiler, PCRE2 for nginx
sudo apt-get install -y wrk util-linux git curl build-essential libpcre2-dev

# Node 26.12.0
curl -fsSLO https://nodejs.org/dist/v26.12.0/node-v26.12.0-linux-x64.tar.xz
curl -fsSL https://nodejs.org/dist/v26.12.0/SHASUMS256.txt | grep linux-x64.tar.xz | sha256sum -c
sudo tar -xJf node-v26.12.0-linux-x64.tar.xz -C /opt
export NODE=/opt/node-v26.12.0-linux-x64/bin/node

# Bun 1.4.3
curl -fsSL https://bun.sh/install | bash -s bun-v1.4.3

# Go: any Go 1.21 or later fetches the pinned go1.27.2 named in go.mod. Ubuntu
# 24.04's golang-go (1.22) is new enough; 22.04's (1.18) is not, so there take
# go.dev's tarball: https://go.dev/dl/go1.27.2.linux-amd64.tar.gz
sudo apt-get install -y golang-go

# Rust: rustup; build.sh installs the pinned 1.99.1 itself
curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal
```

nginx needs no package: `build.sh` downloads nginx 1.30.6 from nginx.org and
builds it into `build/http-twins/nginx/`. Ubuntu's own `nginx` package is not
the pinned version.

## Build, check, run

- `build.sh [name...]` builds every twin, or only the named ones, into
  `build/http-twins/<name>/`.
- `check.mjs [--payload file] [name...]` checks the built twins. It starts each
  one, and the Nish server too when `build/bench/h1` exists. Over one
  keep-alive connection it sends `/plaintext`, `/json`, `/json-echo` and
  `/json-echo-doc`, and compares status, Content-Type and body byte for byte.
  On a mismatch it exits 1 and names the server, the request and the first
  differing byte. Without names, a twin that is not built is a failure too, so
  `build.sh && check.mjs` checks all eight. Without `--payload` it reads `bench/http-payload.json`.
- `run.sh [http.mjs args]` times the servers.
  1. It builds `bench/http1-server.ts` twice, into `build/bench/h1` and
     `build/bench/h1-copy`, and refuses to go on unless the two are
     byte-identical.
  2. It runs `check.mjs`.
  3. It runs `node bench/http.mjs` over `nish`, `nish-copy` and every built
     twin.

  The spread between `nish` and `nish-copy` is the noise band: read every other
  difference against it.

Build products stay out of git. Everything is written under `build/` (the
staging copies and downloads under `build/http-twins/.stage/`, and nginx's
per-port pid file under `build/http-twins/nginx/run/`). This directory's
`.gitignore` covers a toolchain run by hand in the tree. After a build,
`git status --porcelain bench/http-twins` is empty.
