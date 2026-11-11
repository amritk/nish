# WP44: Streaming file reads

**State:** In progress · **Done:** 3 of 4 · **Design note:** [`docs/wp44-streaming-files.md`](https://github.com/amritk/nish/blob/main/docs/wp44-streaming-files.md)

## Stages

- [x] Q1 to Q9 answered *(owner's decision)*
- [x] F1: `fileOpen`, `fileReadAt`, `fileSize` and `fileClose`, native and Node
- [x] F2: the same on the wasm targets
- [ ] F3: the HTTP/1.1 example of [#710](https://github.com/amritk/nish/issues/710) with flat memory

## Next

F3: the HTTP/1.1 example of [#710](https://github.com/amritk/nish/issues/710), serving a file a window at a time with flat memory. Spec: [§10 Stages](https://github.com/amritk/nish/blob/main/docs/wp44-streaming-files.md#10-stages-once-the-questions-are-settled).

## Not planned

Writing, directories, `sendfile`.

[All work packages](index.md)
