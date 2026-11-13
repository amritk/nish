# WP27: Calling C

**State:** Landed · **Done:** 5 of 5 · **Design note:** [`docs/wp27-ffi.md`](https://github.com/amritk/nish/blob/main/docs/wp27-ffi.md)

## Stages

- [x] S1: `declare function` with scalars
- [x] S2: the opaque `CPtr`
- [x] S3: `string` in and out, `readCString`, a literal-`null` `CPtr | null` parameter
- [x] S4: C structs by a layout declaration
  - [x] S4.1: `declare class` as a C struct layout, passed by pointer
  - [x] S4.2: `readStruct`, a copy of a C-owned struct
- [x] S5: `errno`: `cErrno()` in `nish:unsafe`, zeroed before and saved after each C call

## Next

Nothing scheduled: every stage is built. What is not planned is below; the note says what would reopen it.

## Not planned

`string[]` as `char **`, C callbacks, variadic C functions.

[All work packages](index.md)
