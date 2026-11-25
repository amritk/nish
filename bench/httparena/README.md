# The HttpArena entry

[HttpArena](https://github.com/MDA2AV/HttpArena) entry for Nish, in its
`frameworks/<name>/` layout. Standard mode: every body is computed per request,
and nothing is precomputed or cached by URL.

To use it, copy this directory to `frameworks/nish/` in an HttpArena checkout
and rename `nish.dockerfile` to `Dockerfile`. HttpArena builds that name; this
repository's file-name lint refuses a capitalised one, as it does for
`bench/techempower/`.

```sh
cp -r bench/httparena "$HTTPARENA/frameworks/nish"
mv "$HTTPARENA/frameworks/nish/nish.dockerfile" "$HTTPARENA/frameworks/nish/Dockerfile"
cd "$HTTPARENA" && scripts/validate.sh nish
```

## Files

| File | What it is |
| --- | --- |
| `main.ts` | The entry point: it reads the CMD's arguments and calls `arenaMain`. |
| `server.ts` | The routes, over `nish/net/http-server` on 8080 and h2c on 8082, one prefork worker a core. |
| `db.ts` | The `/async-db` query, over `nish/net/postgres`, its pool sized from `DATABASE_MAX_CONN`. |
| `meta.json` | The profiles HttpArena runs and the entry's completeness axes. |
| `nish.dockerfile` | The image: a released compiler from `install.sh` and LLVM 18. |

`tests/link/httparena_entry` builds `server.ts` and drives every route through
one worker: split and chunked requests, a lower-case `content-length`, random
operands, 32 overlapping `/delay` requests and `json-comp` with no
`Accept-Encoding`.

## Validation

`scripts/validate.sh nish` passed, 47 passed and 0 failed, at HttpArena
commit `3388e4586647ad7d9fd09faec3363f078ded0a9e`, with the entry installing
Nish 0.46.0. Its subscribed profiles were `baseline`, `pipelined`, `limited-conn`, `async`,
`latency-1m`, `latency-10k`, `json-comp`, `baseline-h2c`, `json-h2c` and
`async-db`, and its checks included the exhaustive fragmentation check (9 request shapes,
1,047 split offsets).

The run was in a sandbox that needed three local changes, none to this
directory's code:

- The base images were pulled from `mirror.gcr.io` and tagged `ubuntu:24.04`
  and `postgres:18`, because Docker Hub answered 429 Too Many Requests.
- The image trusted the sandbox's TLS proxy CA, added before `install.sh` is
  fetched.
- `--ulimit memlock=-1:-1` was lowered to the sandbox's 8 MiB hard limit,
  which runc could not raise. The entry locks no memory.
