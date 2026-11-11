# WP27: Calling C

**State:** In progress · **Done:** 4 of 5 · **Design note:** [`docs/wp27-ffi.md`](https://github.com/amritk/nish/blob/main/docs/wp27-ffi.md)

## Stages

- [x] S1: `declare function` with scalars
- [x] S2: the opaque `CPtr`
- [x] S3: `string` in and out, `readCString`, a literal-`null` `CPtr | null` parameter
- [ ] S4: C structs by a layout declaration *(owner's decision)*
- [x] S5: `errno`: `cErrno()` in `nish:unsafe`, zeroed before and saved after each C call

## Next

S4, C structs by a layout declaration.

## Waiting on a decision

Nothing: the owner decided to build both S4 and S5. Spec: [§3 Stages](https://github.com/amritk/nish/blob/main/docs/wp27-ffi.md#3-stages).

## Not planned

`string[]` as `char **`, C callbacks, variadic C functions.

[All work packages](index.md)
