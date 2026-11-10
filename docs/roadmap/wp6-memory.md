# WP6: Memory: escape-analysed stack, arena scopes, `T | null`

**State:** Landed · **Done:** 1 of 3 · **Design note:** [`docs/wp6-memory.md`](https://github.com/amritk/nish/blob/main/docs/wp6-memory.md)

## Stages

- [x] Arenas, escape-analysed stack allocation, call-site, callee and loop-pass scopes, and `using a = arena()`
- [ ] A stack rule for branch-assigned locals and objects stored into a local container *(deferred)*
- [ ] Precise `llvm.lifetime.start`/`end` on hoisted allocas *(deferred)*

## Next

Nothing scheduled. Any unchecked item is deferred; the note says what would reopen it.

## Not planned

Reference counting.

[All work packages](index.md)
