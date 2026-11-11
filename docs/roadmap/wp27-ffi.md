# WP27: Calling C

**State:** In progress · **Done:** 3 of 5 · **Design note:** [`docs/wp27-ffi.md`](https://github.com/amritk/nish/blob/main/docs/wp27-ffi.md)

## Stages

- [x] S1: `declare function` with scalars
- [x] S2: the opaque `CPtr`
- [x] S3: `string` in and out, `readCString`, a literal-`null` `CPtr | null` parameter
- [ ] S4: C structs by a layout declaration *(owner's decision)*
- [ ] S5: `errno` *(owner's decision)*

## Next

Waiting on the decision about S4 and S5.

## Waiting on a decision

Whether S4 and S5 happen at all, which the note calls a language question rather than a schedule. Spec: [§3 Stages](https://github.com/amritk/nish/blob/main/docs/wp27-ffi.md#3-stages).

## Not planned

`string[]` as `char **`, C callbacks, variadic C functions.

[All work packages](index.md)
