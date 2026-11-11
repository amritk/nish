# WP45: Name resolution: a DNS stub resolver

**State:** Landed · **Done:** 1 of 1 · **Design note:** [`docs/wp45-name-resolution.md`](https://github.com/amritk/nish/blob/main/docs/wp45-name-resolution.md)

## Stages

- [x] `nish/net/dns` on the caller's loop, `resolveHost` for start-up, and `resolv.conf`'s `search`, `ndots`, `timeout` and `attempts`

## Next

Nothing scheduled. Any unchecked item is deferred; the note says what would reopen it.

## Not planned

`getaddrinfo`, a shared cache, DNSSEC, DNS over TLS or HTTPS.

[All work packages](index.md)
