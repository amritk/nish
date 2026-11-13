# WP55: An object graph a WebAssembly module keeps between calls

**State:** Landed · **Done:** 1 of 1 · **Design note:** [`docs/wp55-persistent-root.md`](https://github.com/amritk/nish/blob/main/docs/wp55-persistent-root.md)

## Stages

- [x] R1: root storage — checker, descriptors, `nish_root_keep`, loader, tests and docs

## Next

Nothing scheduled. Any unchecked item is deferred; the note says what would reopen it.

## Not planned

A generational keep, a root reachable from a page, and the types root storage refuses to trace (`Map`, `Set`, function references, handles).

[All work packages](index.md)
